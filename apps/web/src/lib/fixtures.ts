import type { ProductDetail, ProductSummary } from '@zhs/shared';

/**
 * Design-time fixtures.
 *
 * These exist so the storefront can be built, reviewed and screenshotted before
 * the database is provisioned and before the catalogue is entered — not as a
 * permanent mock layer. `getCatalog()` uses them only when USE_FIXTURES is set;
 * with it unset the app talks to the real API and a failure surfaces as a
 * failure rather than silently falling back to invented products.
 *
 * Copy here is placeholder and must be replaced with approved wording
 * before launch. Prices are the ones currently listed on Amazon where known.
 */

interface Fixture extends Omit<ProductDetail, 'purchasable'> {
  purchasable?: boolean;
}

function product(fixture: Fixture): ProductDetail {
  return { ...fixture, purchasable: fixture.status === 'available' };
}

function bookCover(filename: string, title: string) {
  return {
    url: `/covers/${filename}`,
    alt: `Cover artwork for ${title}`,
    width: 896,
    height: 1200,
  };
}

const ACCENTS = {
  /**
   * Sampled from the real cover artwork in public/covers, not copied from the
   * generation prompts — the printed result drifts from what was asked for.
   * `foreground` is whichever of --ink / --paper-raised actually passes
   * contrast on that colour; every one of these clears WCAG AA.
   */
  soar: { accent: '#ac452c', tint: '#f1e2d8', foreground: '#fffefa' },
  turnaspurn: { accent: '#627343', tint: '#e8e7db', foreground: '#fffefa' },
  bloom: { accent: '#c97c5b', tint: '#f4e8de', foreground: '#1e2525' },
  brightStar: { accent: '#eba81c', tint: '#f8eed7', foreground: '#1e2525' },
  lightFour: { accent: '#2b4768', tint: '#e1e2e0', foreground: '#fffefa' },
  lightThree: { accent: '#e4cd9c', tint: '#f7f2e6', foreground: '#1e2525' },
  lightTwo: { accent: '#c88564', tint: '#f4e9df', foreground: '#1e2525' },
  journalMarigold: { accent: '#e9ab36', tint: '#f8eeda', foreground: '#1e2525' },
  journalMoss: { accent: '#697754', tint: '#e9e8dd', foreground: '#fffefa' },
} as const;

export const FIXTURE_PRODUCTS: ProductDetail[] = [
  product({
    id: 1,
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
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2025-06-03',
    amazonUrl: 'https://www.amazon.com/dp/EXAMPLE-SOAR',
    accent: ACCENTS.soar,
    featured: true,
    coverImage: bookCover('soar.jpg', 'Soar'),
    images: [bookCover('soar.jpg', 'Soar')],
    attribution: 'Zainab H. Suleiman',
    book: {
      authorName: 'Zainab H. Suleiman',
      illustratorName: 'Ify Okonkwo',
      isbn: '978-1-0000000-1-1',
      pageCount: 40,
      format: 'Hardcover',
      ageRange: '4–8 years',
    },
    issue: null,
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 2,
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
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2025-09-16',
    amazonUrl: null,
    accent: ACCENTS.turnaspurn,
    featured: true,
    coverImage: bookCover('turnaspurn.jpg', 'TurnaSpurn'),
    images: [bookCover('turnaspurn.jpg', 'TurnaSpurn')],
    attribution: 'Ekene Adeyemi',
    book: {
      authorName: 'Ekene Adeyemi',
      illustratorName: null,
      isbn: null,
      pageCount: 56,
      format: 'Hardcover',
      ageRange: '7–11 years',
    },
    issue: null,
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 3,
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
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2024-03-12',
    amazonUrl: 'https://www.amazon.com/dp/EXAMPLE-BLOOM',
    accent: ACCENTS.bloom,
    featured: false,
    coverImage: bookCover('bloom.jpg', 'Bloom'),
    images: [bookCover('bloom.jpg', 'Bloom')],
    attribution: 'Zainab H. Suleiman',
    book: {
      authorName: 'Zainab H. Suleiman',
      illustratorName: 'Ify Okonkwo',
      isbn: '978-1-0000000-2-8',
      pageCount: 36,
      format: 'Paperback',
      ageRange: '5–9 years',
    },
    issue: null,
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 4,
    slug: 'bright-star',
    type: 'book',
    status: 'available',
    title: 'Bright Star',
    subtitle: 'You were always this size',
    blurb:
      'A book about self-worth for children who have started measuring themselves against other people.',
    description: 'Bright Star is about the quiet arithmetic children do about their own value.',
    priceCents: 1399,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2023-11-07',
    amazonUrl: 'https://www.amazon.com/dp/EXAMPLE-BRIGHTSTAR',
    accent: ACCENTS.brightStar,
    featured: false,
    coverImage: bookCover('bright-star.jpg', 'Bright Star'),
    images: [bookCover('bright-star.jpg', 'Bright Star')],
    attribution: 'Amara Nwosu',
    book: {
      authorName: 'Amara Nwosu',
      illustratorName: null,
      isbn: '978-1-0000000-3-5',
      pageCount: 32,
      format: 'Paperback',
      ageRange: '4–8 years',
    },
    issue: null,
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),

  // ---- Light magazine -----------------------------------------------------
  product({
    id: 10,
    slug: 'light-issue-4',
    type: 'magazine',
    status: 'available',
    title: 'Light, Issue Four',
    subtitle: 'Inheritance',
    blurb:
      'What gets handed down that nobody chose to hand down. Twenty-two writers and artists on inheritance.',
    description: null,
    priceCents: 1200,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2025-07-01',
    amazonUrl: null,
    accent: ACCENTS.lightFour,
    featured: true,
    coverImage: bookCover('light-issue-4.jpg', 'Light, Issue Four'),
    images: [bookCover('light-issue-4.jpg', 'Light, Issue Four')],
    attribution: 'Issue 4',
    book: null,
    issue: {
      issueNumber: 4,
      theme: 'Inheritance',
      editorNote:
        'We asked for work about what gets passed on. Almost everything we received was about hands.',
      publishedDate: '2025-07-01',
      contributors: [
        { name: 'Ruth Ellinger', slug: 'ruth-ellinger', pieceTitle: 'Nine Ways of Keeping' },
        { name: 'Sade Balogun', slug: 'sade-balogun', pieceTitle: 'My Mother’s Hands' },
        { name: 'Tomas Reyes', slug: 'tomas-reyes', pieceTitle: 'Cartography' },
      ],
    },
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 11,
    slug: 'light-issue-3',
    type: 'magazine',
    status: 'sold_out',
    title: 'Light, Issue Three',
    subtitle: 'Repair',
    blurb: 'On mending, and on the things that are better for having been broken.',
    description: null,
    priceCents: 1200,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2024-11-04',
    amazonUrl: null,
    accent: ACCENTS.lightThree,
    featured: false,
    coverImage: bookCover('light-issue-3.jpg', 'Light, Issue Three'),
    images: [bookCover('light-issue-3.jpg', 'Light, Issue Three')],
    attribution: 'Issue 3',
    book: null,
    issue: {
      issueNumber: 3,
      theme: 'Repair',
      editorNote: null,
      publishedDate: '2024-11-04',
      contributors: [],
    },
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 12,
    slug: 'light-issue-2',
    type: 'magazine',
    status: 'sold_out',
    title: 'Light, Issue Two',
    subtitle: 'Thresholds',
    blurb: 'Doorways, waiting rooms, and the minute before the news.',
    description: null,
    priceCents: 1000,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: '2023-10-02',
    amazonUrl: null,
    accent: ACCENTS.lightTwo,
    featured: false,
    coverImage: bookCover('light-issue-2.jpg', 'Light, Issue Two'),
    images: [bookCover('light-issue-2.jpg', 'Light, Issue Two')],
    attribution: 'Issue 2',
    book: null,
    issue: {
      issueNumber: 2,
      theme: 'Thresholds',
      editorNote: null,
      publishedDate: '2023-10-02',
      contributors: [],
    },
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),

  // ---- Stationery ---------------------------------------------------------
  product({
    id: 20,
    slug: 'journal-marigold',
    type: 'stationery',
    status: 'available',
    title: 'The Marigold Journal',
    subtitle: 'Lined, 160 pages',
    blurb:
      'A lay-flat notebook with an artist-designed cover, printed on paper that takes fountain ink without complaint.',
    description: null,
    priceCents: 2450,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: null,
    amazonUrl: 'https://www.amazon.com/dp/EXAMPLE-MARIGOLD',
    accent: ACCENTS.journalMarigold,
    featured: false,
    coverImage: bookCover('journal-marigold.jpg', 'The Marigold Journal'),
    images: [bookCover('journal-marigold.jpg', 'The Marigold Journal')],
    attribution: 'Cover by Ify Okonkwo',
    book: null,
    issue: null,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Cloth-bound board, 100gsm paper',
      pageCount: 160,
      coverArtist: 'Ify Okonkwo',
    },
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 21,
    slug: 'journal-moss',
    type: 'stationery',
    status: 'available',
    title: 'The Moss Journal',
    subtitle: 'Dotted, 160 pages',
    blurb: 'The same notebook, in a green you will want to keep on the desk rather than in a bag.',
    description: null,
    priceCents: 2450,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: null,
    amazonUrl: null,
    accent: ACCENTS.journalMoss,
    featured: false,
    coverImage: bookCover('journal-moss.jpg', 'The Moss Journal'),
    images: [bookCover('journal-moss.jpg', 'The Moss Journal')],
    attribution: 'Cover by Ify Okonkwo',
    book: null,
    issue: null,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Cloth-bound board, 100gsm paper',
      pageCount: 160,
      coverArtist: 'Ify Okonkwo',
    },
    seoTitle: null,
    seoDescription: null,
  }),
];

export const FIXTURE_SUMMARIES: ProductSummary[] = FIXTURE_PRODUCTS.map(
  ({ description, images, book, issue, stationery, seoTitle, seoDescription, ...summary }) =>
    summary,
);
