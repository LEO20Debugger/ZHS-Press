/**
 * The wire contract between apps/web and apps/api.
 *
 * Defined once here and used on both sides: Nest validates incoming bodies
 * against these, and the web app infers its fetch types from the same objects.
 * This is what stops the two apps drifting.
 */

import { z } from 'zod';

/* ---- Primitives ------------------------------------------------------- */

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase words separated by single hyphens');

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a six-digit hex colour, e.g. #b13f2f');

export const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const productTypeSchema = z.enum(['book', 'magazine', 'stationery']);
export const productStatusSchema = z.enum([
  'draft',
  'coming_soon',
  'available',
  'sold_out',
  'archived',
]);

/* ---- Catalogue -------------------------------------------------------- */

/** Shop filtering (brief s2.4). Category maps directly onto product type. */
export const productQuerySchema = z.object({
  category: productTypeSchema.optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
  sort: z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'title']).default('newest'),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

/* ---- Cart -------------------------------------------------------------
 * Note what is absent: no price field. The client says what and how many;
 * the server decides what it costs.
 */

export const addToCartSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  productId: z.number().int().positive(),
  /** Zero removes the line. */
  quantity: z.number().int().min(0).max(20),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/* ---- Checkout --------------------------------------------------------- */

export const postalAddressSchema = z.object({
  name: z.string().trim().min(1).max(255),
  line1: z.string().trim().min(1).max(255),
  line2: z.string().trim().max(255).optional(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(32),
  /** ISO 3166-1 alpha-2. */
  country: z.string().trim().length(2).toUpperCase(),
  phone: z.string().trim().max(32).optional(),
});
export type PostalAddressInput = z.infer<typeof postalAddressSchema>;

export const createCheckoutSchema = z.object({
  email: emailSchema,
  shippingAddress: postalAddressSchema,
  billingAddress: postalAddressSchema.optional(),
  customerNote: z.string().trim().max(1000).optional(),
  /** Opt into the newsletter during checkout. Unticked by default. */
  subscribeToNewsletter: z.boolean().default(false),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

/* ---- Capture: newsletter, waitlist, submissions ----------------------- */

export const newsletterSignupSchema = z.object({
  email: emailSchema,
  source: z.string().trim().max(40).optional(),
  /**
   * Honeypot. Real users never fill this; bots fill every field they find.
   * A non-empty value is accepted with a 200 and silently discarded, so the
   * bot has nothing to learn from the response.
   */
  website: z.string().max(0).optional(),
});
export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>;

export const waitlistSignupSchema = z.object({
  productId: z.number().int().positive(),
  email: emailSchema,
  website: z.string().max(0).optional(),
});
export type WaitlistSignupInput = z.infer<typeof waitlistSignupSchema>;

export const submissionGenreSchema = z.enum([
  'fiction',
  'non_fiction',
  'children',
  'poetry',
  'other',
]);

/** Brief s2.5: fiction, non-fiction, children's books, literary content. */
export const createSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  genre: submissionGenreSchema,
  title: z.string().trim().min(1).max(255),
  synopsis: z.string().trim().min(50, 'Please write at least a short paragraph').max(5000),
  website: z.string().max(0).optional(),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

/* ---- Admin ------------------------------------------------------------ */

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/**
 * Type-specific detail, stored in a satellite table per product type.
 *
 * Every field here is optional at the schema level, including the two the
 * database marks NOT NULL (`authorName`, `issueNumber`). That is deliberate:
 * the admin form saves whatever has been filled in so far, and a book whose
 * author has not been typed yet must still be savable as a draft. The service
 * decides whether there is enough to write a row at all — see
 * `AdminProductsService.upsertDetails`.
 *
 * Anything blank is normalised to undefined, so an emptied field clears the
 * column rather than storing "".
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const bookDetailsSchema = z.object({
  authorName: optionalText(255),
  illustratorName: optionalText(255),
  isbn: optionalText(20),
  pageCount: z.number().int().positive().max(10_000).optional(),
  format: optionalText(60),
  ageRange: optionalText(40),
});

export const magazineIssueSchema = z.object({
  issueNumber: z.number().int().positive().max(10_000).optional(),
  theme: optionalText(255),
  editorNote: z.string().max(50_000).optional(),
  publishedDate: z.string().date().optional(),
});

export const stationeryDetailsSchema = z.object({
  dimensions: optionalText(120),
  material: optionalText(160),
  pageCount: z.number().int().positive().max(10_000).optional(),
  coverArtist: optionalText(255),
});

export type BookDetailsInput = z.infer<typeof bookDetailsSchema>;
export type MagazineIssueInput = z.infer<typeof magazineIssueSchema>;
export type StationeryDetailsInput = z.infer<typeof stationeryDetailsSchema>;

export const upsertProductSchema = z
  .object({
    slug: slugSchema,
    type: productTypeSchema,
    status: productStatusSchema.default('draft'),
    title: z.string().trim().min(1).max(255),
    subtitle: z.string().trim().max(255).optional(),
    blurb: z.string().trim().max(2000).optional(),
    description: z.string().max(50_000).optional(),
    priceCents: centsSchema,
    compareAtCents: centsSchema.optional(),
    releaseDate: z.string().date().optional(),
    amazonUrl: z.string().url().max(512).optional(),
    accentHex: hexColorSchema.optional(),
    featured: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
    seoTitle: z.string().trim().max(255).optional(),
    seoDescription: z.string().trim().max(320).optional(),

    // Only the block matching `type` is read; the others are ignored, so the
    // form can keep all three mounted and switch which is visible.
    book: bookDetailsSchema.optional(),
    issue: magazineIssueSchema.optional(),
    stationery: stationeryDetailsSchema.optional(),
  })
  .refine((p) => p.compareAtCents == null || p.compareAtCents > p.priceCents, {
    message: 'The compare-at price must be higher than the actual price',
    path: ['compareAtCents'],
  })
  .refine((p) => p.status !== 'coming_soon' || p.releaseDate != null, {
    message: 'A "coming soon" title needs a release date to show a waitlist against',
    path: ['releaseDate'],
  })
  /*
   * `book_details.author_name` and `magazine_issues.issue_number` are NOT NULL
   * in the database, but a half-filled draft has to be savable — so the
   * requirement is enforced at the moment it starts to matter: when the title
   * stops being a draft and becomes something the storefront will render.
   *
   * Without this the failure surfaces as a database constraint error on save,
   * which tells an editor nothing about which field to fill in.
   */
  .refine((p) => p.type !== 'book' || p.status === 'draft' || Boolean(p.book?.authorName), {
    message: 'A book needs an author before it can leave draft',
    path: ['book', 'authorName'],
  })
  .refine((p) => p.type !== 'magazine' || p.status === 'draft' || p.issue?.issueNumber != null, {
    message: 'An issue needs an issue number before it can leave draft',
    path: ['issue', 'issueNumber'],
  });
export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

/**
 * Attaching a product image.
 *
 * `url` accepts a site-relative path (the covers served from the web app's
 * public directory) or an absolute URL (a CDN, once one exists). `alt` is
 * required rather than optional — an image with no alt text is invisible to a
 * screen reader, and the storefront relies on it always being present.
 */
export const contributorRoleSchema = z.enum(['author', 'illustrator', 'editor', 'contributor']);

/**
 * Attaching a contributor to a product.
 *
 * A contributor is a *person*, not a line on one product — the same writer
 * recurs across issues of Light, and the storefront links a name to everything
 * they have appeared in. So this takes either an existing `contributorId` or a
 * `name` to create one from, never both, and the service resolves which.
 *
 * `pieceTitle` is the title of their piece *within this issue*, which is why it
 * lives on the join rather than on the person.
 */
export const attachContributorSchema = z
  .object({
    contributorId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    role: contributorRoleSchema.default('contributor'),
    pieceTitle: z
      .string()
      .trim()
      .max(255)
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
  })
  .refine((input) => Boolean(input.contributorId) !== Boolean(input.name), {
    message: 'Choose an existing contributor or give a new name, not both',
    path: ['name'],
  });

export type AttachContributorInput = z.infer<typeof attachContributorSchema>;
export type ContributorRole = z.infer<typeof contributorRoleSchema>;

export const addProductImageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine(
      (value) => value.startsWith('/') || /^https?:\/\//.test(value),
      'Must be a site-relative path like /covers/soar.jpg, or an http(s) URL',
    ),
  alt: z.string().trim().min(1, 'Describe the image for screen readers').max(320),
  position: z.number().int().min(0).optional(),
});
export type AddProductImageInput = z.infer<typeof addProductImageSchema>;
