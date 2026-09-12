/**
 * The launch catalogue.
 *
 * Accent colours are sampled from the actual cover artwork, not copied from
 * the palette — generated art drifts from what was asked for, and the
 * per-title theming is only convincing when it matches the cover.
 *
 * Re-run `pnpm sample:accents` whenever artwork changes, or a product page
 * will theme itself in a colour its cover no longer contains. Every value here
 * carries its paired foreground at WCAG AA.
 *
 * Copy is placeholder pending approved wording.
 */

export interface CatalogueEntry {
  slug: string;
  type: 'book' | 'magazine' | 'stationery';
  status: 'draft' | 'coming_soon' | 'available' | 'sold_out' | 'archived';
  title: string;
  subtitle?: string;
  blurb?: string;
  description?: string;
  priceCents: number;
  accentHex: string;
  accentTintHex: string;
  releaseDate?: string;
  amazonUrl?: string;
  featured?: boolean;
  quantity: number;
  /** Filename in apps/web/public/covers. */
  cover: string;
  book?: {
    authorName: string;
    illustratorName?: string;
    isbn?: string;
    pageCount?: number;
    format?: string;
    ageRange?: string;
  };
  issue?: { issueNumber: number; theme?: string; editorNote?: string; publishedDate?: string };
  stationery?: {
    dimensions?: string;
    material?: string;
    pageCount?: number;
    coverArtist?: string;
  };
}

export const CATALOGUE: CatalogueEntry[] = [
  {
    slug: 'soar',
    type: 'book',
    status: 'available',
    title: 'Soar',
    subtitle: 'A story about finding your own height',
    blurb:
      'Two siblings, one impossible hill, and an afternoon that turns into the summer they will tell stories about for years.',
    description:
      'Soar follows Ada and her younger brother Tomi through a single long afternoon outdoors, and the small negotiations of courage that happen between siblings when no adult is watching.',
    priceCents: 1499,
    accentHex: '#ab3d25',
    accentTintHex: '#f1e1d8',
    releaseDate: '2025-06-03',
    featured: true,
    quantity: 40,
    cover: 'soar.jpg',
    book: {
      authorName: 'Zainab H. Suleiman',
      illustratorName: 'Ify Okonkwo',
      isbn: '978-1-0000000-1-1',
      pageCount: 40,
      format: 'Hardcover',
      ageRange: '4–8 years',
    },
  },
  {
    slug: 'turnaspurn',
    type: 'book',
    status: 'coming_soon',
    title: 'TurnaSpurn',
    subtitle: 'A tale told backwards, then forwards again',
    blurb:
      'A word that means nothing until you say it twice. A village that only appears to those willing to walk home the long way.',
    description:
      'TurnaSpurn is a folk tale in the shape of a riddle — read once for the story, again for what the story was hiding.',
    priceCents: 1699,
    accentHex: '#677749',
    accentTintHex: '#e8e8dc',
    releaseDate: '2025-09-16',
    featured: true,
    quantity: 0,
    cover: 'turnaspurn.jpg',
    book: {
      authorName: 'Ekene Adeyemi',
      pageCount: 56,
      format: 'Hardcover',
      ageRange: '7–11 years',
    },
  },
  {
    slug: 'bloom',
    type: 'book',
    status: 'available',
    title: 'Bloom',
    subtitle: 'On grief, and what grows after',
    blurb:
      'A gentle picture book about losing someone, and the surprising places their memory keeps turning up.',
    description:
      'Bloom was written for the conversations that are hard to start. It does not rush the reader toward feeling better.',
    priceCents: 1499,
    accentHex: '#d27d58',
    accentTintHex: '#f5e8de',
    releaseDate: '2024-03-12',
    quantity: 25,
    cover: 'bloom.jpg',
    book: {
      authorName: 'Zainab H. Suleiman',
      illustratorName: 'Ify Okonkwo',
      isbn: '978-1-0000000-2-8',
      pageCount: 36,
      format: 'Paperback',
      ageRange: '5–9 years',
    },
  },
  {
    slug: 'bright-star',
    type: 'book',
    status: 'available',
    title: 'Bright Star',
    subtitle: 'You were always this size',
    blurb:
      'A book about self-worth for children who have started measuring themselves against other people.',
    description: 'Bright Star is about the quiet arithmetic children do about their own value.',
    priceCents: 1399,
    accentHex: '#f7a808',
    accentTintHex: '#faeed4',
    releaseDate: '2023-11-07',
    quantity: 18,
    cover: 'bright-star.jpg',
    book: {
      authorName: 'Amara Nwosu',
      isbn: '978-1-0000000-3-5',
      pageCount: 32,
      format: 'Paperback',
      ageRange: '4–8 years',
    },
  },

  {
    slug: 'light-issue-4',
    type: 'magazine',
    status: 'available',
    title: 'Light, Issue Four',
    subtitle: 'Inheritance',
    blurb:
      'What gets handed down that nobody chose to hand down. Twenty-two writers and artists on inheritance.',
    priceCents: 1200,
    accentHex: '#f2d2a1',
    accentTintHex: '#f9f3e7',
    releaseDate: '2025-07-01',
    featured: true,
    quantity: 120,
    cover: 'light-issue-4.jpg',
    issue: {
      issueNumber: 4,
      theme: 'Inheritance',
      editorNote:
        'We asked for work about what gets passed on. Almost everything we received was about hands.',
      publishedDate: '2025-07-01',
    },
  },
  {
    slug: 'light-issue-3',
    type: 'magazine',
    // Sold out, not archived: the issue stays browsable in the archive.
    status: 'sold_out',
    title: 'Light, Issue Three',
    subtitle: 'Repair',
    blurb: 'On mending, and on the things that are better for having been broken.',
    priceCents: 1200,
    accentHex: '#e8cb95',
    accentTintHex: '#f8f2e5',
    releaseDate: '2024-11-04',
    quantity: 0,
    cover: 'light-issue-3.jpg',
    issue: { issueNumber: 3, theme: 'Repair', publishedDate: '2024-11-04' },
  },
  {
    slug: 'light-issue-2',
    type: 'magazine',
    status: 'sold_out',
    title: 'Light, Issue Two',
    subtitle: 'Thresholds',
    blurb: 'Doorways, waiting rooms, and the minute before the news.',
    priceCents: 1000,
    accentHex: '#d6825d',
    accentTintHex: '#f6e9de',
    releaseDate: '2023-10-02',
    quantity: 0,
    cover: 'light-issue-2.jpg',
    issue: { issueNumber: 2, theme: 'Thresholds', publishedDate: '2023-10-02' },
  },

  {
    slug: 'journal-marigold',
    type: 'stationery',
    status: 'available',
    title: 'The Marigold Journal',
    subtitle: 'Lined, 160 pages',
    blurb:
      'A lay-flat notebook with an artist-designed cover, printed on paper that takes fountain ink without complaint.',
    priceCents: 2450,
    accentHex: '#e6aa35',
    accentTintHex: '#f8eeda',
    quantity: 60,
    cover: 'journal-marigold.jpg',
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Cloth-bound board, 100gsm paper',
      pageCount: 160,
      coverArtist: 'Ify Okonkwo',
    },
  },
  {
    slug: 'journal-moss',
    type: 'stationery',
    status: 'available',
    title: 'The Moss Journal',
    subtitle: 'Dotted, 160 pages',
    blurb:
      'The same notebook, in a green you will want to keep on the desk rather than in a bag.',
    priceCents: 2450,
    accentHex: '#5a6946',
    accentTintHex: '#e7e6dc',
    quantity: 45,
    cover: 'journal-moss.jpg',
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Cloth-bound board, 100gsm paper',
      pageCount: 160,
      coverArtist: 'Ify Okonkwo',
    },
  },
];
