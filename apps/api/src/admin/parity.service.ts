import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import { formatMoney } from '@zhs/shared';
import { DB } from '../db/db.module';

/**
 * Amazon parity (brief s3 and s5).
 *
 * A full SP-API integration is disproportionate — Trust manages the Amazon
 * account by hand. What actually helps is a list of what is out of sync and a
 * CSV to reconcile against, so this reports rather than automates.
 */
@Injectable()
export class ParityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async publicProducts() {
    return this.db.query.products.findMany({
      where: inArray(schema.products.status, ['coming_soon', 'available', 'sold_out']),
      with: { book: true },
    });
  }

  async report() {
    const products = await this.publicProducts();
    const missingAmazon = products.filter((p) => !p.amazonUrl);
    const missingIsbn = products.filter((p) => p.type === 'book' && !p.book?.isbn);

    return {
      total: products.length,
      linked: products.length - missingAmazon.length,
      missingAmazon: missingAmazon.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        type: p.type,
      })),
      missingIsbn: missingIsbn.map((p) => ({ id: p.id, slug: p.slug, title: p.title })),
    };
  }

  /** CSV for Trust to reconcile against the Amazon backend. */
  async csv(): Promise<string> {
    const products = await this.publicProducts();

    const escape = (value: unknown): string => {
      const text = value == null ? '' : String(value);
      // RFC 4180: quote anything containing a comma, quote or newline, and
      // double any embedded quotes. Book titles contain commas constantly.
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const header = ['slug', 'title', 'type', 'status', 'price_usd', 'isbn', 'amazon_url'];
    const rows = products.map((p) =>
      [
        p.slug,
        p.title,
        p.type,
        p.status,
        formatMoney(p.priceCents, 'USD'),
        p.book?.isbn ?? '',
        p.amazonUrl ?? '',
      ]
        .map(escape)
        .join(','),
    );

    return [header.join(','), ...rows].join('\r\n');
  }
}
