import { LOW_STOCK_THRESHOLD } from '@zhs/shared';
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

interface Fixture extends Omit<ProductDetail, 'purchasable' | 'stockLevel' | 'stockRemaining'> {
  purchasable?: boolean;
  /**
   * Copies left, so the low-stock treatment can be seen without a database.
   * Omitted means plenty — the same answer the API gives for stock it is not
   * tracking.
   */
  stock?: number;
}

function product(fixture: Fixture): ProductDetail {
  // Mirrors ProductsService.stockFor: one rule, stated the same way on both
  // sides, so a fixture cannot show a badge the real API would not.
  const stockLevel =
    fixture.stock == null
      ? 'in_stock'
      : fixture.stock <= 0
        ? 'out'
        : fixture.stock <= LOW_STOCK_THRESHOLD
          ? 'low'
          : 'in_stock';

  return {
    ...fixture,
    purchasable: fixture.status === 'available',
    stockLevel,
    stockRemaining: stockLevel === 'low' ? fixture.stock! : stockLevel === 'out' ? 0 : null,
  };
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
  journalAnwulika: { accent: '#ff4320', tint: '#fbe1d7', foreground: '#1e2525' },
  journalAko: { accent: '#79d4cb', tint: '#ebf3ec', foreground: '#1e2525' },
  journalKpakpando: { accent: '#ffa72f', tint: '#fbedd9', foreground: '#1e2525' },
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
    // Deliberately short, so the low-stock treatment is visible in review.
    stock: 3,
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
    title: 'LIGHT, Issue Four',
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
    coverImage: bookCover('light-issue-4.jpg', 'LIGHT, Issue Four'),
    images: [bookCover('light-issue-4.jpg', 'LIGHT, Issue Four')],
    attribution: 'Issue 4',
    book: null,
    issue: {
      issueNumber: 4,
      theme: 'Inheritance',
      editorNote:
        'We asked for work about what gets passed on. Almost everything we received was about hands.',
      publishedDate: '2025-07-01',
      isLatest: true,
      latestUntil: null,
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
    title: 'LIGHT, Issue Three',
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
    coverImage: bookCover('light-issue-3.jpg', 'LIGHT, Issue Three'),
    images: [bookCover('light-issue-3.jpg', 'LIGHT, Issue Three')],
    attribution: 'Issue 3',
    book: null,
    issue: {
      issueNumber: 3,
      theme: 'Repair',
      editorNote: null,
      publishedDate: '2024-11-04',
      isLatest: false,
      latestUntil: null,
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
    title: 'LIGHT, Issue Two',
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
    coverImage: bookCover('light-issue-2.jpg', 'LIGHT, Issue Two'),
    images: [bookCover('light-issue-2.jpg', 'LIGHT, Issue Two')],
    attribution: 'Issue 2',
    book: null,
    issue: {
      issueNumber: 2,
      theme: 'Thresholds',
      editorNote: null,
      publishedDate: '2023-10-02',
      isLatest: false,
      latestUntil: null,
      contributors: [],
    },
    stationery: null,
    seoTitle: null,
    seoDescription: null,
  }),

  // ---- Stationery ---------------------------------------------------------
  product({
    id: 20,
    slug: 'journal-anwulika',
    type: 'stationery',
    status: 'available',
    title: 'Anwulika',
    subtitle: 'Lined A5 notebook, 120 pages',
    blurb:
      'The beautiful reminder that your joy will always outweigh your struggles.',
    description:
      'Anwulika — /Ah-nwoo-lee-kah/, noun: joy is greater. Use these pages to collect your wins, count your blessings, and remember who you are. Añụrị ga-adị — joy will remain.',
    priceCents: 2450,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: null,
    amazonUrl: null,
    accent: ACCENTS.journalAnwulika,
    featured: false,
    coverImage: bookCover('journal-anwulika.jpg', 'Anwulika'),
    images: [bookCover('journal-anwulika.jpg', 'Anwulika')],
    attribution: 'Cover by Zeeoma',
    book: null,
    issue: null,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 21,
    slug: 'journal-ako',
    type: 'stationery',
    status: 'available',
    title: 'Ako',
    subtitle: 'Lined A5 notebook, 120 pages',
    blurb:
      'Designed for the deep thinkers, the strategy-planners, and the meticulous curators of their own lives.',
    description:
      'Ako — /ah-kaw/, noun: wisdom. A notebook built for absolute mental clarity. Mụọ amamihe.',
    priceCents: 2450,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: null,
    amazonUrl: null,
    accent: ACCENTS.journalAko,
    featured: false,
    coverImage: bookCover('journal-ako.jpg', 'Ako'),
    images: [bookCover('journal-ako.jpg', 'Ako')],
    attribution: 'Cover by Zeeoma',
    book: null,
    issue: null,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
    seoTitle: null,
    seoDescription: null,
  }),
  product({
    id: 22,
    slug: 'journal-kpakpando',
    type: 'stationery',
    status: 'available',
    title: 'Kpakpando',
    subtitle: 'Lined A5 notebook, 120 pages',
    blurb:
      'More than just a light in the sky; it is the spark in your head.',
    description:
      'Kpakpando — /KPAH-KPAH-ndoh/, noun: star. Let this be your canvas for big dreams, small wins, and everything in between. Oya, shine your light.',
    priceCents: 2450,
    compareAtCents: null,
    currency: 'USD',
    releaseDate: null,
    amazonUrl: null,
    accent: ACCENTS.journalKpakpando,
    featured: false,
    coverImage: bookCover('journal-kpakpando.jpg', 'Kpakpando'),
    images: [bookCover('journal-kpakpando.jpg', 'Kpakpando')],
    attribution: 'Cover by Zeeoma',
    book: null,
    issue: null,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
    seoTitle: null,
    seoDescription: null,
  }),
];

export const FIXTURE_SUMMARIES: ProductSummary[] = FIXTURE_PRODUCTS.map(
  ({ description, images, book, issue, stationery, seoTitle, seoDescription, ...summary }) =>
    summary,
);
