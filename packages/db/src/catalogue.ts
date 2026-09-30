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
 * Book and magazine copy is placeholder pending approved wording. The
 * stationery entries are real: names, meanings and specs are taken from the
 * supplied Zeeoma cover artwork.
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
  /**
   * The cover's real pixel size, carried so nothing has to assume one.
   *
   * Covers are not a single shape: the picture books are 4:5, LIGHT is trade
   * magazine, the journals are A5. A shared default was fine while every cover
   * was generated to the same dimensions and became a layout bug the moment
   * the real artwork arrived — the browser reserves space from these numbers,
   * so a wrong pair shifts the page as each image loads.
   *
   * Re-run `pnpm optimise:covers`, then read the sizes off the files.
   */
  coverWidth: number;
  coverHeight: number;
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
    accentHex: '#98c5a7',
    accentTintHex: '#eef1e7',
    releaseDate: '2025-06-03',
    featured: true,
    quantity: 40,
    cover: 'soar.jpg',
    coverWidth: 960,
    coverHeight: 1200,
    book: {
      authorName: 'Juliet Isioma Ezepue',
      illustratorName: 'Tooba Alam',
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
    title: 'Tales of TurnaSpurn Street',
    subtitle: 'A tale told backwards, then forwards again',
    blurb:
      'A word that means nothing until you say it twice. A village that only appears to those willing to walk home the long way.',
    description:
      'Tales of TurnaSpurn Street is a folk tale in the shape of a riddle — read once for the story, again for what the story was hiding.',
    priceCents: 1699,
    accentHex: '#5a444a',
    accentTintHex: '#e7e2dc',
    releaseDate: '2025-09-16',
    featured: true,
    quantity: 0,
    cover: 'turnaspurn.jpg',
    coverWidth: 960,
    coverHeight: 1200,
    book: {
      authorName: 'Lotanna Ezepue',
      illustratorName: 'Tooba Alam',
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
    accentHex: '#fbbb64',
    accentTintHex: '#faf0df',
    releaseDate: '2024-03-12',
    quantity: 25,
    cover: 'bloom.jpg',
    coverWidth: 960,
    coverHeight: 1200,
    book: {
      authorName: 'Juliet Isioma Ezepue',
      illustratorName: 'Maria Noemi Manalang',
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
    accentHex: '#7ba4d7',
    accentTintHex: '#ebeded',
    releaseDate: '2023-11-07',
    quantity: 18,
    cover: 'bright-star.jpg',
    coverWidth: 960,
    coverHeight: 1200,
    book: {
      authorName: 'Juliet Isioma Ezepue',
      illustratorName: 'Maria Noemi Manalang',
      isbn: '978-1-0000000-3-5',
      pageCount: 32,
      format: 'Paperback',
      ageRange: '4–8 years',
    },
  },

  /* ---- LIGHT ------------------------------------------------------------
   * Leaders Igniting Generational Healing and Transformation.
   *
   * Every issue is framed by a "How might we" question printed on its own
   * cover, so the blurbs below are each issue's actual brief rather than
   * copy written for the shop.
   */
  {
    slug: 'light-issue-4',
    type: 'magazine',
    status: 'available',
    title: 'LIGHT, Issue Four',
    subtitle: 'Healthy spaces and places',
    blurb: 'How might we create healthy spaces and places for all?',
    priceCents: 1200,
    accentHex: '#592c28',
    accentTintHex: '#e7dfd8',
    releaseDate: '2025-07-01',
    featured: true,
    quantity: 120,
    cover: 'light-issue-4.jpg',
    coverWidth: 927,
    coverHeight: 1200,
    issue: {
      issueNumber: 4,
      theme: 'Healthy spaces and places',
      publishedDate: '2025-07-01',
    },
  },
  {
    slug: 'light-issue-3',
    type: 'magazine',
    // Sold out, not archived: the issue stays browsable in the archive.
    status: 'sold_out',
    title: 'LIGHT, Issue Three',
    subtitle: 'Healing and transformation with cancer',
    blurb:
      'How might we reimagine healing and transformation with cancer through art, letters, stories, and poetry?',
    priceCents: 1200,
    accentHex: '#f47624',
    accentTintHex: '#f9e8d8',
    releaseDate: '2024-11-04',
    quantity: 0,
    cover: 'light-issue-3.jpg',
    coverWidth: 927,
    coverHeight: 1200,
    issue: {
      issueNumber: 3,
      theme: 'Healing and transformation with cancer',
      publishedDate: '2024-11-04',
    },
  },
  {
    slug: 'light-issue-2',
    type: 'magazine',
    status: 'sold_out',
    title: 'LIGHT, Issue Two',
    subtitle: 'Wellness in public health',
    blurb:
      'How might we reflect and reimagine wellness in public health as art, letters, stories, and poetry?',
    priceCents: 1000,
    accentHex: '#293a45',
    accentTintHex: '#e1e0db',
    releaseDate: '2023-10-02',
    quantity: 0,
    cover: 'light-issue-2.jpg',
    coverWidth: 927,
    coverHeight: 1200,
    issue: {
      issueNumber: 2,
      theme: 'Wellness in public health',
      publishedDate: '2023-10-02',
    },
  },
  {
    /*
     * The first issue, and the only cover carrying a printed price: $14.99.
     * Draft until the press confirms whether it is still for sale and at what
     * stock — a back issue published live at a guessed status is worse than
     * one the shop does not list yet.
     */
    slug: 'light-issue-1',
    type: 'magazine',
    status: 'draft',
    title: 'LIGHT, Issue One',
    subtitle: 'Public health as art',
    blurb: 'How might we recreate public health as art, letters, stories, and poetry?',
    priceCents: 1499,
    accentHex: '#17773b',
    accentTintHex: '#dfe8da',
    quantity: 0,
    cover: 'light-issue-1.jpg',
    coverWidth: 927,
    coverHeight: 1200,
    issue: {
      issueNumber: 1,
      theme: 'Public health as art',
    },
  },

  /* ---- Stationery ------------------------------------------------------- */
  {
    slug: 'journal-anwulika',
    type: 'stationery',
    status: 'available',
    title: 'Anwulika',
    subtitle: 'Lined A5 notebook, 120 pages',
    blurb: 'The beautiful reminder that your joy will always outweigh your struggles.',
    description:
      'Anwulika — /Ah-nwoo-lee-kah/, noun: joy is greater. Use these pages to collect your wins, count your blessings, and remember who you are. Añụrị ga-adị — joy will remain.',
    priceCents: 2450,
    // Sampled #ff3d19, lifted 3% toward paper: the sampled value lands at 4.41
    // against ink, just under AA, and every accent here has to clear it.
    accentHex: '#ff4320',
    accentTintHex: '#fbe1d7',
    quantity: 60,
    cover: 'journal-anwulika.jpg',
    coverWidth: 846,
    coverHeight: 1200,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
  },
  {
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
    accentHex: '#79d4cb',
    accentTintHex: '#ebf3ec',
    quantity: 60,
    cover: 'journal-ako.jpg',
    coverWidth: 846,
    coverHeight: 1200,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
  },
  {
    slug: 'journal-kpakpando',
    type: 'stationery',
    status: 'available',
    title: 'Kpakpando',
    subtitle: 'Lined A5 notebook, 120 pages',
    blurb: 'More than just a light in the sky; it is the spark in your head.',
    description:
      'Kpakpando — /KPAH-KPAH-ndoh/, noun: star. Let this be your canvas for big dreams, small wins, and everything in between. Oya, shine your light.',
    priceCents: 2450,
    accentHex: '#ffa72f',
    accentTintHex: '#fbedd9',
    quantity: 60,
    cover: 'journal-kpakpando.jpg',
    coverWidth: 846,
    coverHeight: 1200,
    stationery: {
      dimensions: '148 × 210 mm (A5)',
      material: 'Soft-touch cover, acid-free paper',
      pageCount: 120,
      coverArtist: 'Zeeoma',
    },
  },
  {
    /*
     * The LIGHT companion journal. Nothing on the cover gives a price or a
     * page count, so it stays a draft rather than going live at a number
     * copied from the Zeeoma journals.
     */
    slug: 'light-journal',
    type: 'stationery',
    status: 'draft',
    title: 'LIGHT Journal',
    subtitle: 'You are gonna wanna write this down.',
    blurb: 'The companion journal to LIGHT, for the writing the magazine starts.',
    priceCents: 2450,
    accentHex: '#466758',
    accentTintHex: '#e4e6de',
    quantity: 0,
    cover: 'light-journal.jpg',
    coverWidth: 846,
    coverHeight: 1200,
    stationery: {
      coverArtist: 'ZHS Press',
    },
  },
];
