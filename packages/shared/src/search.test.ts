import { describe, expect, it } from 'vitest';
import { normalise, searchCatalog, type Searchable } from './search';

const item = (title: string, extra: Partial<Searchable> = {}): Searchable => ({
  title,
  subtitle: null,
  attribution: null,
  blurb: null,
  type: 'book',
  ...extra,
});

const CATALOG = [
  item('Soar', { attribution: 'Juliet Isioma Ezepue' }),
  item('Bloom', { attribution: 'Juliet Isioma Ezepue', blurb: 'A girl plants a seed.' }),
  item('Tales of TurnaSpurn Street', { attribution: 'Lotanna Ezepue' }),
  item('LIGHT, Issue Four', { type: 'magazine', attribution: 'Issue 4' }),
  item('Kpakpando', { type: 'stationery', attribution: 'Cover by Zeeoma' }),
  item('Àdùkẹ́ and the Rain'),
];

const titles = (query: string) => searchCatalog(CATALOG, query).map((r) => r.title);

describe('searchCatalog', () => {
  it('finds a title from its first letters', () => {
    expect(titles('blo')).toEqual(['Bloom']);
  });

  it('finds every title by an author', () => {
    expect(titles('juliet')).toEqual(['Soar', 'Bloom']);
  });

  it('finds a surname across different authors', () => {
    expect(titles('ezepue')).toEqual(['Soar', 'Bloom', 'Tales of TurnaSpurn Street']);
  });

  it('ranks a title match above an author or description match', () => {
    const catalog = [
      item('A Book About Rain', { attribution: 'Bloom Okafor' }),
      item('Bloom'),
    ];
    expect(searchCatalog(catalog, 'bloom').map((r) => r.title)).toEqual(['Bloom', 'A Book About Rain']);
  });

  it('needs every word to match', () => {
    expect(titles('juliet bloom')).toEqual(['Bloom']);
    expect(titles('juliet kpakpando')).toEqual([]);
  });

  it('matches word starts, not fragments inside words', () => {
    expect(titles('pue')).toEqual([]);
  });

  it('finds a title regardless of accents typed or not', () => {
    expect(titles('aduke')).toEqual(['Àdùkẹ́ and the Rain']);
    expect(titles('Àdùkẹ́')).toEqual(['Àdùkẹ́ and the Rain']);
  });

  it('understands the words people use for each kind of product', () => {
    expect(titles('journal')).toEqual(['Kpakpando']);
    expect(titles('magazine')).toEqual(['LIGHT, Issue Four']);
  });

  it('searches descriptions too, below title and author', () => {
    expect(titles('seed')).toEqual(['Bloom']);
  });

  it('ignores case and punctuation', () => {
    expect(titles('LIGHT, issue')).toEqual(['LIGHT, Issue Four']);
  });

  it('returns nothing for an empty or blank query', () => {
    expect(titles('')).toEqual([]);
    expect(titles('   ')).toEqual([]);
  });

  it('honours a limit', () => {
    expect(searchCatalog(CATALOG, 'ezepue', 2)).toHaveLength(2);
  });
});

describe('normalise', () => {
  it('folds accents and punctuation', () => {
    expect(normalise('  Àdùkẹ́, & the Rain! ')).toBe('aduke the rain');
  });
});
