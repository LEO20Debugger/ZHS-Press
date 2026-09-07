import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import {
  deriveTint,
  validateAccent,
  INK,
  LIGHT_MAGAZINE_ACCENT,
  TERRACOTTA,
} from '@zhs/ui';
import type {
  AccentPairing,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
} from '@zhs/shared';
import { DB } from '../db/db.module';

type ProductRow = typeof schema.products.$inferSelect;

/** Statuses a shopper may see. Drafts and archived titles are staff-only. */
const PUBLIC_STATUSES = ['coming_soon', 'available', 'sold_out'] as const;

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(query: ProductQuery): Promise<Paginated<ProductSummary>> {
    const filters: SQL[] = [inArray(schema.products.status, [...PUBLIC_STATUSES])];

    if (query.category) {
      filters.push(eq(schema.products.type, query.category));
    }
    if (query.featured != null) {
      filters.push(eq(schema.products.featured, query.featured));
    }

    const where = and(...filters);

    const [{ value: total } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(schema.products)
      .where(where);

    const rows = await this.db.query.products.findMany({
      where,
      orderBy: this.orderBy(query.sort),
      limit: query.perPage,
      offset: (query.page - 1) * query.perPage,
      with: {
        images: { orderBy: asc(schema.productImages.position), limit: 1 },
        book: true,
        issue: true,
        stationery: true,
      },
    });

    return {
      items: rows.map((row) => this.toSummary(row)),
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findBySlug(slug: string): Promise<ProductDetail> {
    const row = await this.db.query.products.findFirst({
      where: and(
        eq(schema.products.slug, slug),
        inArray(schema.products.status, [...PUBLIC_STATUSES]),
      ),
      with: {
        images: { orderBy: asc(schema.productImages.position) },
        book: true,
        issue: true,
        stationery: true,
        contributors: {
          orderBy: asc(schema.productContributors.position),
          with: { contributor: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`No product found at "${slug}"`);
    }

    return this.toDetail(row);
  }

  /**
   * The magazine archive (brief 2.3): every issue stays visible, including
   * sold-out ones. Sold out changes the button, not whether the page exists.
   */
  async listIssues(): Promise<ProductSummary[]> {
    const rows = await this.db.query.products.findMany({
      where: and(
        eq(schema.products.type, 'magazine'),
        inArray(schema.products.status, [...PUBLIC_STATUSES]),
      ),
      with: { images: { orderBy: asc(schema.productImages.position), limit: 1 }, issue: true },
    });

    return rows
      .map((row) => this.toSummary(row))
      .sort((a, b) => (b.attribution ?? '').localeCompare(a.attribution ?? '', undefined, {
        numeric: true,
      }));
  }

  private orderBy(sort: ProductQuery['sort']) {
    switch (sort) {
      case 'oldest':
        return asc(schema.products.createdAt);
      case 'price_asc':
        return asc(schema.products.priceCents);
      case 'price_desc':
        return desc(schema.products.priceCents);
      case 'title':
        return asc(schema.products.title);
      case 'newest':
      default:
        return [asc(schema.products.sortOrder), desc(schema.products.createdAt)];
    }
  }

  /**
   * Resolves the stored accent into the full pairing the templates need.
   *
   * An accent is a background, so the readable foreground depends on the
   * colour: saturated pigments take paper text, light ones take ink. Resolving
   * it here means no template has to guess, and a colour that somehow got past
   * admin validation degrades to the house accent rather than rendering
   * unreadable text.
   */
  private resolveAccent(row: ProductRow): AccentPairing | null {
    const fallback = row.type === 'magazine' ? LIGHT_MAGAZINE_ACCENT : TERRACOTTA;
    const accent = row.accentHex ?? fallback;

    const validation = validateAccent(accent);
    if (!validation.valid) {
      const safe = validateAccent(fallback);
      return {
        accent: fallback,
        tint: deriveTint(fallback),
        foreground: safe.valid ? safe.foreground : INK,
      };
    }

    return {
      accent,
      tint: row.accentTintHex ?? deriveTint(accent),
      foreground: validation.foreground,
    };
  }

  private attributionFor(row: {
    type: ProductRow['type'];
    book?: { authorName: string } | null;
    issue?: { issueNumber: number } | null;
    stationery?: { coverArtist: string | null } | null;
  }): string | null {
    switch (row.type) {
      case 'book':
        return row.book?.authorName ?? null;
      case 'magazine':
        return row.issue ? `Issue ${row.issue.issueNumber}` : null;
      case 'stationery':
        return row.stationery?.coverArtist ? `Cover by ${row.stationery.coverArtist}` : null;
      default:
        return null;
    }
  }

  private toSummary(row: ProductRow & Record<string, any>): ProductSummary {
    const cover = row.images?.[0] ?? null;

    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      status: row.status,
      title: row.title,
      subtitle: row.subtitle,
      blurb: row.blurb,
      priceCents: row.priceCents,
      compareAtCents: row.compareAtCents,
      currency: row.currency as ProductSummary['currency'],
      releaseDate: row.releaseDate ? String(row.releaseDate) : null,
      amazonUrl: row.amazonUrl,
      accent: this.resolveAccent(row),
      featured: row.featured,
      coverImage: cover
        ? { url: cover.url, alt: cover.alt, width: cover.width, height: cover.height }
        : null,
      attribution: this.attributionFor(row),
      // Only an available title can be bought. coming_soon offers a waitlist,
      // sold_out stays browsable in the archive.
      purchasable: row.status === 'available',
    };
  }

  private toDetail(row: ProductRow & Record<string, any>): ProductDetail {
    return {
      ...this.toSummary(row),
      description: row.description,
      images: (row.images ?? []).map((image: any) => ({
        url: image.url,
        alt: image.alt,
        width: image.width,
        height: image.height,
      })),
      book: row.book ?? null,
      issue: row.issue
        ? {
            issueNumber: row.issue.issueNumber,
            theme: row.issue.theme,
            editorNote: row.issue.editorNote,
            publishedDate: row.issue.publishedDate ? String(row.issue.publishedDate) : null,
            contributors: (row.contributors ?? []).map((link: any) => ({
              name: link.contributor.name,
              slug: link.contributor.slug,
              pieceTitle: link.pieceTitle,
            })),
          }
        : null,
      stationery: row.stationery ?? null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    };
  }
}
