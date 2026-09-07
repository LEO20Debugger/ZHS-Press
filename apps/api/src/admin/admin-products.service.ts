import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, like, or, type SQL } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import { deriveTint, validateAccent, ACCENT_PALETTE } from '@zhs/ui';
import type { UpsertProductInput } from '@zhs/shared';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';
import type { AdminPrincipal } from '../auth/auth.service';

@Injectable()
export class AdminProductsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
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

    await this.audit.record(actor, 'product.update', 'product', String(id), changes);
    return this.findOne(id);
  }

  /**
   * Archiving, not deleting.
   *
   * A product referenced by past order items must not vanish — the storefront
   * stops showing it, but the record survives. Per the brief, removals are
   * signed off by the Publishing Associate, and archiving keeps that reversible.
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

  async setInventory(id: number, quantity: number, actor: AdminPrincipal) {
    await this.findOne(id);
    await this.db
      .insert(schema.inventory)
      .values({ productId: id, quantity })
      .onDuplicateKeyUpdate({ set: { quantity } });

    await this.audit.record(actor, 'inventory.set', 'product', String(id), {
      quantity: { from: null, to: quantity },
    });

    return { ok: true };
  }
}
