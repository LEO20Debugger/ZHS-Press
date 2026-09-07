import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

/**
 * One `products` table with typed satellite tables, rather than three parallel
 * tables. This is what makes the single unified, category-filterable shop
 * (brief 2.4) straightforward, and lets one cart hold a book, a magazine issue
 * and a journal together.
 */

export const productType = ['book', 'magazine', 'stationery'] as const;
export const productStatus = [
  'draft',
  'coming_soon',
  'available',
  'sold_out',
  'archived',
] as const;

export const products = mysqlTable(
  'products',
  {
    id: int('id').autoincrement().primaryKey(),
    /** Public identifier. The numeric id is never exposed in URLs. */
    slug: varchar('slug', { length: 160 }).notNull(),
    type: mysqlEnum('type', productType).notNull(),
    status: mysqlEnum('status', productStatus).notNull().default('draft'),

    title: varchar('title', { length: 255 }).notNull(),
    subtitle: varchar('subtitle', { length: 255 }),
    /** Short card/listing copy. */
    blurb: text('blurb'),
    /** Long-form product copy, stored as MDX. */
    description: text('description'),

    /** Money is always an integer number of minor units. Never a float. */
    priceCents: int('price_cents', { unsigned: true }).notNull(),
    /** Optional strike-through price for sale display. */
    compareAtCents: int('compare_at_cents', { unsigned: true }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),

    /**
     * Calendar date, not an instant. Stored and read as a plain string so a
     * timezone conversion can never shift a release by a day.
     */
    releaseDate: date('release_date', { mode: 'string' }),
    /** Brief 2.2/3: every listing mirrors an Amazon listing. */
    amazonUrl: varchar('amazon_url', { length: 512 }),

    /**
     * Per-title accent colour sampled from the cover. This is what stops every
     * book and issue page feeling templated. Validated on save: must carry
     * --ink at >= 4.5:1 as a background. See @zhs/ui contrast helpers.
     */
    accentHex: varchar('accent_hex', { length: 7 }),
    accentTintHex: varchar('accent_tint_hex', { length: 7 }),

    featured: boolean('featured').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),

    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 320 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_type_status_idx').on(t.type, t.status),
    index('products_featured_idx').on(t.featured),
  ],
);

export const bookDetails = mysqlTable('book_details', {
  productId: int('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  illustratorName: varchar('illustrator_name', { length: 255 }),
  isbn: varchar('isbn', { length: 20 }),
  pageCount: int('page_count', { unsigned: true }),
  format: varchar('format', { length: 60 }),
  ageRange: varchar('age_range', { length: 40 }),
});

export const magazineIssues = mysqlTable(
  'magazine_issues',
  {
    productId: int('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    issueNumber: int('issue_number', { unsigned: true }).notNull(),
    theme: varchar('theme', { length: 255 }),
    /** Editor note, MDX. */
    editorNote: text('editor_note'),
    publishedDate: date('published_date', { mode: 'string' }),
  },
  (t) => [uniqueIndex('magazine_issues_number_idx').on(t.issueNumber)],
);

export const stationeryDetails = mysqlTable('stationery_details', {
  productId: int('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  dimensions: varchar('dimensions', { length: 120 }),
  material: varchar('material', { length: 160 }),
  pageCount: int('page_count', { unsigned: true }),
  coverArtist: varchar('cover_artist', { length: 255 }),
});

export const productImages = mysqlTable(
  'product_images',
  {
    id: int('id').autoincrement().primaryKey(),
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 512 }).notNull(),
    /** Required, not nullable. Accessibility enforced at the data layer. */
    alt: varchar('alt', { length: 320 }).notNull(),
    width: int('width', { unsigned: true }),
    height: int('height', { unsigned: true }),
    position: int('position').notNull().default(0),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.position)],
);

/**
 * Light is an anthology; its contributor list is a large part of the appeal,
 * and contributors recur across issues.
 */
export const contributors = mysqlTable(
  'contributors',
  {
    id: int('id').autoincrement().primaryKey(),
    slug: varchar('slug', { length: 160 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    bio: text('bio'),
    photoUrl: varchar('photo_url', { length: 512 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contributors_slug_idx').on(t.slug)],
);

export const contributorRole = ['author', 'illustrator', 'editor', 'contributor'] as const;

export const productContributors = mysqlTable(
  'product_contributors',
  {
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    contributorId: int('contributor_id')
      .notNull()
      .references(() => contributors.id, { onDelete: 'cascade' }),
    role: mysqlEnum('role', contributorRole).notNull().default('contributor'),
    /** Title of the piece within the issue, where relevant. */
    pieceTitle: varchar('piece_title', { length: 255 }),
    position: int('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.contributorId, t.role] })],
);

export const inventory = mysqlTable('inventory', {
  productId: int('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  quantity: int('quantity').notNull().default(0),
  trackInventory: boolean('track_inventory').notNull().default(true),
  allowBackorder: boolean('allow_backorder').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  book: one(bookDetails, { fields: [products.id], references: [bookDetails.productId] }),
  issue: one(magazineIssues, { fields: [products.id], references: [magazineIssues.productId] }),
  stationery: one(stationeryDetails, {
    fields: [products.id],
    references: [stationeryDetails.productId],
  }),
  inventory: one(inventory, { fields: [products.id], references: [inventory.productId] }),
  images: many(productImages),
  contributors: many(productContributors),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productContributorsRelations = relations(productContributors, ({ one }) => ({
  product: one(products, { fields: [productContributors.productId], references: [products.id] }),
  contributor: one(contributors, {
    fields: [productContributors.contributorId],
    references: [contributors.id],
  }),
}));

export const contributorsRelations = relations(contributors, ({ many }) => ({
  products: many(productContributors),
}));
