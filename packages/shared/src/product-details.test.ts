import { describe, expect, it } from 'vitest';
import { upsertProductSchema } from './schemas';

/** A valid product, to be spread and overridden per case. */
const BASE = {
  slug: 'soar',
  type: 'book' as const,
  title: 'Soar',
  priceCents: 1999,
};

function parse(overrides: Record<string, unknown>) {
  return upsertProductSchema.safeParse({ ...BASE, ...overrides });
}

/** The first error message recorded against a dotted field path. */
function errorAt(result: ReturnType<typeof parse>, path: string): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('book details', () => {
  it('accepts a draft with no author, so work in progress can be saved', () => {
    // The database marks author_name NOT NULL, but an editor filling the form
    // in over two sittings must still be able to save.
    const result = parse({ status: 'draft', book: { authorName: '' } });
    expect(result.success).toBe(true);
  });

  it('refuses to publish a book with no author', () => {
    const result = parse({ status: 'available', book: { illustratorName: 'Ada' } });
    expect(result.success).toBe(false);
    expect(errorAt(result, 'book.authorName')).toMatch(/author/i);
  });

  it('refuses every non-draft status, not just available', () => {
    for (const status of ['available', 'coming_soon', 'sold_out', 'archived']) {
      const result = parse({
        status,
        // coming_soon separately requires a release date; supply one so this
        // case fails for the reason under test rather than that one.
        releaseDate: '2026-10-01',
        book: {},
      });
      expect(errorAt(result, 'book.authorName'), `status ${status}`).toMatch(/author/i);
    }
  });

  it('publishes happily once the author is there', () => {
    const result = parse({ status: 'available', book: { authorName: 'Ada Okonkwo' } });
    expect(result.success).toBe(true);
  });

  it('normalises a blank optional field to undefined rather than ""', () => {
    // Otherwise an emptied field stores an empty string instead of clearing the
    // column, and the storefront renders an empty line where nothing should be.
    const result = parse({ book: { authorName: 'Ada', isbn: '   ', format: '' } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.book?.isbn).toBeUndefined();
      expect(result.data.book?.format).toBeUndefined();
    }
  });

  it('rejects a page count that is not a positive whole number', () => {
    expect(parse({ book: { authorName: 'A', pageCount: 0 } }).success).toBe(false);
    expect(parse({ book: { authorName: 'A', pageCount: -5 } }).success).toBe(false);
    expect(parse({ book: { authorName: 'A', pageCount: 12.5 } }).success).toBe(false);
    expect(parse({ book: { authorName: 'A', pageCount: 32 } }).success).toBe(true);
  });
});

describe('magazine issues', () => {
  it('refuses to publish an issue with no number', () => {
    const result = parse({ type: 'magazine', status: 'available', issue: { theme: 'Water' } });
    expect(errorAt(result, 'issue.issueNumber')).toMatch(/issue number/i);
  });

  it('allows issue number zero to be absent in draft', () => {
    expect(parse({ type: 'magazine', status: 'draft', issue: {} }).success).toBe(true);
  });

  it('accepts a complete issue', () => {
    const result = parse({
      type: 'magazine',
      status: 'available',
      issue: { issueNumber: 4, theme: 'Water', publishedDate: '2026-03-01' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed published date', () => {
    const result = parse({
      type: 'magazine',
      issue: { issueNumber: 4, publishedDate: '01/03/2026' },
    });
    expect(result.success).toBe(false);
  });
});

describe('cross-type rules', () => {
  it('does not demand an author from a magazine or a journal', () => {
    // The book rule must key off the type, or every non-book becomes unsavable.
    expect(parse({ type: 'magazine', status: 'available', issue: { issueNumber: 1 } }).success).toBe(
      true,
    );
    expect(parse({ type: 'stationery', status: 'available' }).success).toBe(true);
  });

  it('does not demand an issue number from a book', () => {
    expect(parse({ type: 'book', status: 'available', book: { authorName: 'A' } }).success).toBe(
      true,
    );
  });

  it('ignores detail blocks that do not match the type', () => {
    // The form only sends the matching block, but the API is a public surface
    // and must not fall over if all three arrive.
    const result = parse({
      type: 'stationery',
      status: 'available',
      book: { authorName: 'Left over from when this was a book' },
      issue: { issueNumber: 9 },
      stationery: { material: 'Cotton paper' },
    });
    expect(result.success).toBe(true);
  });

  it('still enforces the existing coming-soon release date rule', () => {
    const result = parse({ status: 'coming_soon', book: { authorName: 'A' } });
    expect(errorAt(result, 'releaseDate')).toMatch(/release date/i);
  });
});
