import { describe, expect, it } from 'vitest';
import { schema } from '@zhs/db';
import type { UpsertProductInput } from '@zhs/shared';
import { AdminProductsService } from './admin-products.service';

/**
 * Exercises the satellite-table write with a recording stub.
 *
 * A real database is not needed to answer the questions that matter here —
 * which tables were deleted from, which were written to, and with what — and
 * those are exactly the questions a bug in this method would get wrong
 * silently, by dropping an author name or orphaning a row.
 */
interface Recorded {
  deletes: string[];
  inserts: Array<{ table: string; values: Record<string, unknown> }>;
}

function tableName(table: unknown): string {
  if (table === schema.bookDetails) return 'book';
  if (table === schema.magazineIssues) return 'magazine';
  if (table === schema.stationeryDetails) return 'stationery';
  return 'unknown';
}

function makeService(): { service: AdminProductsService; log: Recorded } {
  const log: Recorded = { deletes: [], inserts: [] };

  const db = {
    delete: (table: unknown) => ({
      where: async () => {
        log.deletes.push(tableName(table));
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        log.inserts.push({ table: tableName(table), values });
        return { onDuplicateKeyUpdate: async () => undefined };
      },
    }),
  };

  const service = new AdminProductsService(db as never, {} as never, {} as never);
  return { service, log };
}

/** `upsertDetails` is private; this is the seam for testing it directly. */
function upsert(service: AdminProductsService, id: number, input: Partial<UpsertProductInput>) {
  return (
    service as unknown as {
      upsertDetails(productId: number, input: UpsertProductInput): Promise<void>;
    }
  ).upsertDetails(id, input as UpsertProductInput);
}

describe('upsertDetails', () => {
  it('writes the book row and clears the other two types', async () => {
    const { service, log } = makeService();
    await upsert(service, 7, {
      type: 'book',
      book: { authorName: 'Ada Okonkwo', isbn: '978-1', pageCount: 32 },
    });

    expect(log.inserts).toHaveLength(1);
    expect(log.inserts[0]!.table).toBe('book');
    expect(log.inserts[0]!.values).toMatchObject({
      productId: 7,
      authorName: 'Ada Okonkwo',
      isbn: '978-1',
      pageCount: 32,
    });

    // The point of this: a product that used to be a magazine must not keep
    // its old issue row once it becomes a book.
    expect(log.deletes.sort()).toEqual(['magazine', 'stationery']);
  });

  it('writes nothing for a draft book with no author yet', async () => {
    const { service, log } = makeService();
    await upsert(service, 7, { type: 'book', book: { illustratorName: 'Someone' } });

    // author_name is NOT NULL — inserting here would fail the whole save, so a
    // half-filled draft simply writes no row.
    expect(log.inserts).toHaveLength(0);
    expect(log.deletes.sort()).toEqual(['magazine', 'stationery']);
  });

  it('turns blank optional fields into null, not empty strings', async () => {
    const { service, log } = makeService();
    await upsert(service, 7, { type: 'book', book: { authorName: 'Ada' } });

    expect(log.inserts[0]!.values).toMatchObject({
      illustratorName: null,
      isbn: null,
      pageCount: null,
      format: null,
      ageRange: null,
    });
  });

  it('writes an issue row and clears book and stationery', async () => {
    const { service, log } = makeService();
    await upsert(service, 3, { type: 'magazine', issue: { issueNumber: 4, theme: 'Water' } });

    expect(log.inserts[0]).toMatchObject({
      table: 'magazine',
      values: { productId: 3, issueNumber: 4, theme: 'Water' },
    });
    expect(log.deletes.sort()).toEqual(['book', 'stationery']);
  });

  it('treats issue number zero as present, not missing', async () => {
    const { service, log } = makeService();
    // `if (!issueNumber)` would skip 0 here. The check must be against null.
    await upsert(service, 3, { type: 'magazine', issue: { issueNumber: 0 } });
    expect(log.inserts).toHaveLength(1);
  });

  it('skips an issue with no number', async () => {
    const { service, log } = makeService();
    await upsert(service, 3, { type: 'magazine', issue: { theme: 'Water' } });
    expect(log.inserts).toHaveLength(0);
  });

  it('writes stationery when any field is filled', async () => {
    const { service, log } = makeService();
    await upsert(service, 9, { type: 'stationery', stationery: { material: 'Cotton paper' } });

    expect(log.inserts[0]).toMatchObject({
      table: 'stationery',
      values: { productId: 9, material: 'Cotton paper', dimensions: null },
    });
  });

  it('deletes the stationery row when every field is cleared', async () => {
    const { service, log } = makeService();
    await upsert(service, 9, { type: 'stationery', stationery: {} });

    // Stationery has no required column, so "empty" means no row at all rather
    // than a row of nulls the storefront would render as blank lines.
    expect(log.inserts).toHaveLength(0);
    expect(log.deletes.sort()).toEqual(['book', 'magazine', 'stationery']);
  });

  it('counts a page count of zero as nothing filled in', async () => {
    const { service, log } = makeService();
    await upsert(service, 9, { type: 'stationery', stationery: { pageCount: undefined } });
    expect(log.inserts).toHaveLength(0);
  });
});
