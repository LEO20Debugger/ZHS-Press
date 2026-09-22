import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import { deriveTint, validateAccent, ACCENT_PALETTE } from '@zhs/ui';
import type { UpsertProductInput } from '@zhs/shared';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';
import { WaitlistNotifier } from './waitlist-notifier.service';
import type { AdminPrincipal } from '../auth/auth.service';

@Injectable()
export class AdminProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly waitlist: WaitlistNotifier,
  ) {}

  /**
   * Validates a per-title accent before it can be saved.
   *
   * This is the gate the whole colour system depends on. An accent is used as a
   * *background* across a product page, so what matters is whether either of
   * the two text colours stays readable on it. `validateAccent` picks the
   * better one and rejects colours in the mid-tone band where neither works.
   *
   * The resolved tint is derived here rather than asked of the editor: it is a
   * mechanical mix toward the paper ground, and letting someone type it by hand
   * only creates a way for it to be wrong.
   */
  private resolveAccent(accentHex: string | undefined): {
    accentHex: string | null;
    accentTintHex: string | null;
  } {
    if (!accentHex) return { accentHex: null, accentTintHex: null };

    const validation = validateAccent(accentHex);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'That accent colour will not be readable.',
        errors: [{ field: 'accentHex', message: validation.reason }],
      });
    }

    return { accentHex, accentTintHex: deriveTint(accentHex) };
  }

  /** The palette the admin colour picker offers, with each colour's pairing. */
  accentOptions() {
    return ACCENT_PALETTE.map((accent) => {
      const validation = validateAccent(accent);
      return {
        hex: accent,
        tint: deriveTint(accent),
        foreground: validation.foreground,
        ratio: Number(validation.ratio.toFixed(2)),
      };
    });
  }

  async list(query: { search?: string; type?: string; status?: string; page?: number }) {
    const page = query.page ?? 1;
    const perPage = 25;
    const filters: SQL[] = [];

    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(like(schema.products.title, term), like(schema.products.slug, term));
      if (match) filters.push(match);
    }
    if (query.type) {
      filters.push(eq(schema.products.type, query.type as 'book'));
    }
    if (query.status) {
      filters.push(eq(schema.products.status, query.status as 'draft'));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(schema.products)
      .where(where);

    // Unlike the storefront, admin sees every status including draft and
    // archived — that is the point of it.
    const items = await this.db.query.products.findMany({
      where,
      orderBy: [desc(schema.products.updatedAt)],
      limit: perPage,
      offset: (page - 1) * perPage,
      with: {
        images: { orderBy: asc(schema.productImages.position), limit: 1 },
        inventory: true,
      },
    });

    return { items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
  }

  /**
   * Writes the type-specific detail row for a product.
   *
   * Three things this has to get right, none of them obvious:
   *
   * **The type can change.** A product saved as a book and later switched to
   * stationery would otherwise keep its `book_details` row forever — invisible
   * in the admin, still joined by the public API, and resurfacing if the type
   * is ever switched back. Rows for every non-matching type are deleted first.
   *
   * **A draft may be incomplete.** `author_name` and `issue_number` are NOT
   * NULL, so a row simply cannot exist until those are filled in. Rather than
   * failing the save, nothing is written until there is enough to write — the
   * schema refuses to let such a title leave draft, which is the point at which
   * the omission actually matters.
   *
   * **Upsert, not insert.** `product_id` is the primary key of each satellite
   * table, so a second save of the same product must update rather than
   * collide.
   */
  private async upsertDetails(productId: number, input: UpsertProductInput): Promise<void> {
    const satellites = [
      { type: 'book', table: schema.bookDetails },
      { type: 'magazine', table: schema.magazineIssues },
      { type: 'stationery', table: schema.stationeryDetails },
    ] as const;

    for (const { type, table } of satellites) {
      if (type !== input.type) {
        await this.db.delete(table).where(eq(table.productId, productId));
      }
    }

    if (input.type === 'book') {
      // No author yet: a draft in progress. Leave the table alone.
      if (!input.book?.authorName) return;

      const values = {
        productId,
        authorName: input.book.authorName,
        illustratorName: input.book.illustratorName ?? null,
        isbn: input.book.isbn ?? null,
        pageCount: input.book.pageCount ?? null,
        format: input.book.format ?? null,
        ageRange: input.book.ageRange ?? null,
      };
      await this.db
        .insert(schema.bookDetails)
        .values(values)
        .onDuplicateKeyUpdate({ set: { ...values, productId: undefined } });
      return;
    }

    if (input.type === 'magazine') {
      if (input.issue?.issueNumber == null) return;

      const isLatest = input.issue.isLatest === true;

      /*
        Exactly one issue leads the magazine page. Clearing every other issue
        first means promoting a new one demotes the old one automatically —
        an editor should never have to remember to go and untick the last one,
        and two issues both claiming to be the latest has no sane rendering.
      */
      if (isLatest) {
        await this.db
          .update(schema.magazineIssues)
          .set({ isLatest: false, latestUntil: null })
          .where(ne(schema.magazineIssues.productId, productId));
      }

      const values = {
        productId,
        issueNumber: input.issue.issueNumber,
        theme: input.issue.theme ?? null,
        editorNote: input.issue.editorNote ?? null,
        publishedDate: input.issue.publishedDate ?? null,
        isLatest,
        // An end date without the flag is meaningless, and the schema rejects
        // it — but never store one anyway.
        latestUntil: isLatest ? (input.issue.latestUntil ?? null) : null,
      };
      await this.db
        .insert(schema.magazineIssues)
        .values(values)
        .onDuplicateKeyUpdate({ set: { ...values, productId: undefined } });
      return;
    }

    if (input.type === 'stationery') {
      const details = input.stationery;
      const hasAnything =
        details &&
        (details.dimensions || details.material || details.coverArtist || details.pageCount != null);

      // Nothing filled in: drop the row rather than storing a set of nulls.
      if (!hasAnything) {
        await this.db
          .delete(schema.stationeryDetails)
          .where(eq(schema.stationeryDetails.productId, productId));
        return;
      }

      const values = {
        productId,
        dimensions: details.dimensions ?? null,
        material: details.material ?? null,
        pageCount: details.pageCount ?? null,
        coverArtist: details.coverArtist ?? null,
      };
      await this.db
        .insert(schema.stationeryDetails)
        .values(values)
        .onDuplicateKeyUpdate({ set: { ...values, productId: undefined } });
    }
  }

  /**
   * Which product the homepage hero currently shows.
   *
   * Derived rather than stored. The homepage asks for featured products sorted
   * by `sortOrder` and takes the first, so the hero is already decided by data
   * that exists — adding an `isHero` column would mean a second source of
   * truth for the same fact, and a boolean that must be true on exactly one row
   * needs a transaction to maintain and still ends up with two or none.
   */
  async currentHero() {
    const [hero] = await this.db.query.products.findMany({
      where: and(eq(schema.products.featured, true), eq(schema.products.status, 'available')),
      orderBy: [asc(schema.products.sortOrder), desc(schema.products.createdAt)],
      limit: 1,
      columns: { id: true, title: true, slug: true, sortOrder: true },
    });

    return hero ?? null;
  }

  /**
   * Promotes a product to the homepage hero.
   *
   * Marks it featured and moves it in front of every other featured product,
   * which is all "being the hero" means. One UPDATE, no exclusivity to
   * maintain, and nothing else has to be touched.
   *
   * Sort order drifts downward as this is used. That is deliberate: the
   * alternative — renumbering every other row to keep the values tidy — is
   * several writes to make a number look nicer, and `sortOrder` is a signed
   * int with room for a few billion promotions.
   */
  async makeHero(id: number, actor: AdminPrincipal) {
    const product = await this.findOne(id);

    if (product.status !== 'available') {
      throw new BadRequestException({
        message: 'Only an available title can be the homepage hero.',
        errors: [
          {
            field: 'status',
            message: `This title is "${product.status}". The homepage shows what can be bought.`,
          },
        ],
      });
    }

    const [lowest] = await this.db
      .select({ value: sql<number>`COALESCE(MIN(${schema.products.sortOrder}), 0)` })
      .from(schema.products)
      .where(eq(schema.products.featured, true));

    await this.db
      .update(schema.products)
      .set({ featured: true, sortOrder: Number(lowest?.value ?? 0) - 1 })
      .where(eq(schema.products.id, id));

    await this.audit.record(actor, 'product.hero', 'product', String(id), {
      hero: { from: false, to: true },
    });

    return this.currentHero();
  }

  async findOne(id: number) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, id),
      with: {
        images: { orderBy: asc(schema.productImages.position) },
        book: true,
        issue: true,
        stationery: true,
        inventory: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(input: UpsertProductInput, actor: AdminPrincipal) {
    const existing = await this.db.query.products.findFirst({
      where: eq(schema.products.slug, input.slug),
    });
    if (existing) {
      throw new BadRequestException({
        message: 'That URL slug is already taken.',
        errors: [{ field: 'slug', message: 'Another product already uses this slug.' }],
      });
    }

    const accent = this.resolveAccent(input.accentHex);

    const [inserted] = await this.db.insert(schema.products).values({
      slug: input.slug,
      type: input.type,
      status: input.status,
      title: input.title,
      subtitle: input.subtitle ?? null,
      blurb: input.blurb ?? null,
      description: input.description ?? null,
      priceCents: input.priceCents,
      compareAtCents: input.compareAtCents ?? null,
      releaseDate: input.releaseDate ?? null,
      amazonUrl: input.amazonUrl ?? null,
      featured: input.featured,
      sortOrder: input.sortOrder,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      ...accent,
    });

    const id = Number((inserted as unknown as { insertId: number }).insertId);

    await this.upsertDetails(id, input);
    await this.db.insert(schema.inventory).values({ productId: id, quantity: 0 });
    await this.audit.record(actor, 'product.create', 'product', String(id), {
      title: { from: null, to: input.title },
    });

    return this.findOne(id);
  }

  async update(id: number, input: UpsertProductInput, actor: AdminPrincipal) {
    const before = await this.findOne(id);
    const accent = this.resolveAccent(input.accentHex);

    await this.db
      .update(schema.products)
      .set({
        slug: input.slug,
        type: input.type,
        status: input.status,
        title: input.title,
        subtitle: input.subtitle ?? null,
        blurb: input.blurb ?? null,
        description: input.description ?? null,
        priceCents: input.priceCents,
        compareAtCents: input.compareAtCents ?? null,
        releaseDate: input.releaseDate ?? null,
        amazonUrl: input.amazonUrl ?? null,
        featured: input.featured,
        sortOrder: input.sortOrder,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        ...accent,
      })
      .where(eq(schema.products.id, id));

    // Price changes in particular are worth a trail — they are the thing a
    // customer disputes months later.
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (before.priceCents !== input.priceCents) {
      changes.priceCents = { from: before.priceCents, to: input.priceCents };
    }
    if (before.status !== input.status) {
      changes.status = { from: before.status, to: input.status };
    }
    if (before.slug !== input.slug) {
      changes.slug = { from: before.slug, to: input.slug };
    }

    await this.upsertDetails(id, input);

    await this.audit.record(actor, 'product.update', 'product', String(id), changes);

    /*
     * A title going on sale is the moment its waitlist is owed an email.
     *
     * Keyed off the *transition*, so saving an already-available product does
     * not re-mail anyone. Detached, because the list may be long — see
     * WaitlistNotifier.notifyInBackground.
     */
    if (WaitlistNotifier.shouldNotify(before.status, input.status)) {
      this.waitlist.notifyInBackground(id);
    }

    return this.findOne(id);
  }

  /**
   * Takes a title off the storefront without destroying it.
   *
   * Reversible, and the right answer for anything that was ever real: the
   * shopper-facing lists exclude `archived`, but the row, its satellites and
   * every reference to it survive. `remove` is the irreversible counterpart.
   */
  async archive(id: number, actor: AdminPrincipal) {
    await this.findOne(id);
    await this.db
      .update(schema.products)
      .set({ status: 'archived' })
      .where(eq(schema.products.id, id));

    await this.audit.record(actor, 'product.archive', 'product', String(id), {
      status: { from: 'previous', to: 'archived' },
    });

    return { ok: true };
  }

  /**
   * Permanent delete, for a title that should never have existed — a
   * placeholder, a duplicate, a typo caught before launch.
   *
   * Refused once the product has been ordered. The schema would technically
   * survive it (`order_items.product_id` is ON DELETE SET NULL, and the title,
   * slug and price are snapshotted on the line), but an order that no longer
   * links to anything is a worse record than an archived product, and the
   * person clicking delete cannot see which titles have sold. So the check is
   * here rather than left to their judgement, and it names the way forward.
   *
   * Everything genuinely owned by the product goes with it: the type satellite,
   * inventory, images, contributor links, open cart lines and waitlist
   * signups all cascade from the foreign keys.
   */
  async remove(id: number, actor: AdminPrincipal) {
    const product = await this.findOne(id);

    const [ordered] = await this.db
      .select({ lines: count() })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.productId, id));

    if ((ordered?.lines ?? 0) > 0) {
      throw new ConflictException({
        message: `"${product.title}" has been ordered and cannot be deleted. Archive it instead — it comes off the storefront and the orders keep their history.`,
      });
    }

    await this.db.delete(schema.products).where(eq(schema.products.id, id));

    // Recorded after the fact, with enough of the row to identify what went:
    // the product id it points at no longer resolves to anything.
    await this.audit.record(actor, 'product.delete', 'product', String(id), {
      deleted: { from: `${product.title} (${product.slug})`, to: null },
    });

    return { ok: true };
  }

  /* ---- Images ---------------------------------------------------------
   * Attaching by URL rather than accepting a binary upload. Object storage is
   * not provisioned yet, and inventing a storage location — a container disk
   * that vanishes on redeploy, say — would be worse than being explicit about
   * the gap. This works today for the covers served from the web app's public
   * directory, and for any CDN URL later, with no change needed when real
   * uploads land.
   */
  async addImage(
    productId: number,
    input: { url: string; alt: string; position?: number; width?: number; height?: number },
    actor: AdminPrincipal,
  ) {
    await this.findOne(productId);

    const existing = await this.db.query.productImages.findMany({
      where: eq(schema.productImages.productId, productId),
    });

    await this.db.insert(schema.productImages).values({
      productId,
      url: input.url,
      // Never nullable: an image with no alt text is invisible to a screen
      // reader, and enforcing it here is why the storefront can rely on it.
      alt: input.alt,
      width: input.width ?? null,
      height: input.height ?? null,
      position: input.position ?? existing.length,
    });

    await this.audit.record(actor, 'product.image.add', 'product', String(productId), {
      url: { from: null, to: input.url },
    });

    return this.findOne(productId);
  }

  async removeImage(productId: number, imageId: number, actor: AdminPrincipal) {
    await this.db
      .delete(schema.productImages)
      .where(
        and(
          eq(schema.productImages.id, imageId),
          eq(schema.productImages.productId, productId),
        ),
      );

    await this.audit.record(actor, 'product.image.remove', 'product', String(productId), {
      imageId: { from: imageId, to: null },
    });

    return this.findOne(productId);
  }

  /** Position 0 is the cover; everything else is a gallery shot. */
  async reorderImages(productId: number, orderedIds: number[], actor: AdminPrincipal) {
    await this.findOne(productId);

    for (const [index, imageId] of orderedIds.entries()) {
      await this.db
        .update(schema.productImages)
        .set({ position: index })
        .where(
          and(
            eq(schema.productImages.id, imageId),
            eq(schema.productImages.productId, productId),
          ),
        );
    }

    await this.audit.record(actor, 'product.image.reorder', 'product', String(productId));
    return this.findOne(productId);
  }

  /**
   * Sets or adjusts the stock held for a product.
   *
   * `delta` is applied as arithmetic in SQL rather than read-modify-write, so a
   * checkout settling in the same moment cannot be undone by the admin's click:
   * "add three" means three more than whatever the row holds when it lands, not
   * three more than what the catalogue happened to render. `GREATEST(…, 0)`
   * mirrors the checkout decrement — stock has no meaningful negative.
   *
   * Restocking past zero also clears `sold_out`, because the pair is what the
   * storefront actually reads: the checkout flips that status on the sale that
   * empties the shelf, and leaving it set would keep a restocked title hidden
   * until someone noticed and edited it by hand. Only `sold_out` is cleared —
   * a draft or archived title has been held back deliberately, and arriving
   * stock is not a reason to publish it.
   */
  async setInventory(
    id: number,
    change: { quantity?: number; delta?: number },
    actor: AdminPrincipal,
  ) {
    const before = await this.findOne(id);
    const previous =
      (before.inventory as typeof schema.inventory.$inferSelect | undefined)?.quantity ?? 0;

    if (change.delta != null) {
      const next = sql`GREATEST(${schema.inventory.quantity} + ${change.delta}, 0)`;
      await this.db
        .insert(schema.inventory)
        .values({ productId: id, quantity: Math.max(previous + change.delta, 0) })
        .onDuplicateKeyUpdate({ set: { quantity: next } });
    } else {
      const quantity = change.quantity ?? 0;
      await this.db
        .insert(schema.inventory)
        .values({ productId: id, quantity })
        .onDuplicateKeyUpdate({ set: { quantity } });
    }

    // Re-read rather than compute: the delta path settled in SQL, so this row
    // is the only place the resulting figure is known for certain.
    const row = await this.db.query.inventory.findFirst({
      where: eq(schema.inventory.productId, id),
    });
    const quantity = row?.quantity ?? 0;

    const restocked = before.status === 'sold_out' && quantity > 0;
    if (restocked) {
      await this.db
        .update(schema.products)
        .set({ status: 'available' })
        .where(eq(schema.products.id, id));
    }

    await this.audit.record(actor, 'inventory.set', 'product', String(id), {
      quantity: { from: previous, to: quantity },
      ...(restocked ? { status: { from: 'sold_out', to: 'available' } } : {}),
    });

    /*
     * Same rule as a status change made in the form: sold out to available is
     * the transition the waitlist is owed an email for, and a restock reaches
     * it by a different door. Detached for the same reason — the list may be
     * long, and the admin's click must not wait on SMTP.
     */
    if (restocked && WaitlistNotifier.shouldNotify('sold_out', 'available')) {
      this.waitlist.notifyInBackground(id);
    }

    return { ok: true, quantity, status: restocked ? 'available' : before.status };
  }
}
