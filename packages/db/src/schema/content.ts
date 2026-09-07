import { relations } from 'drizzle-orm';
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { products } from './products';

/** Newsletter capture is active from day one (brief, release timeline). */
export const subscriberStatus = ['pending', 'confirmed', 'unsubscribed'] as const;

export const newsletterSubscribers = mysqlTable(
  'newsletter_subscribers',
  {
    id: int('id').autoincrement().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    /**
     * Double opt-in. A row is only mailable at `confirmed`; nothing is sent to
     * `pending` beyond the single confirmation message.
     */
    status: mysqlEnum('status', subscriberStatus).notNull().default('pending'),
    /** Single-use, cleared on confirm. */
    confirmToken: varchar('confirm_token', { length: 64 }),
    /** Long-lived, so every email can carry a working one-click unsubscribe. */
    unsubscribeToken: varchar('unsubscribe_token', { length: 64 }).notNull(),
    /** Where the signup came from: 'home', 'footer', 'checkout', 'waitlist'. */
    source: varchar('source', { length: 40 }),
    confirmedAt: timestamp('confirmed_at'),
    unsubscribedAt: timestamp('unsubscribed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('newsletter_email_idx').on(t.email),
    uniqueIndex('newsletter_unsub_token_idx').on(t.unsubscribeToken),
    index('newsletter_status_idx').on(t.status),
  ],
);

/** Powers the "notify me" state on unreleased titles (brief 2.2). */
export const waitlistEntries = mysqlTable(
  'waitlist_entries',
  {
    id: int('id').autoincrement().primaryKey(),
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    notifiedAt: timestamp('notified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('waitlist_product_email_idx').on(t.productId, t.email),
    index('waitlist_notified_idx').on(t.productId, t.notifiedAt),
  ],
);

export const submissionGenre = [
  'fiction',
  'non_fiction',
  'children',
  'poetry',
  'other',
] as const;

export const submissionStatus = ['new', 'reviewing', 'accepted', 'declined'] as const;

/** Brief 2.5. A clean one-pager is sufficient at launch; what matters is that it exists. */
export const submissions = mysqlTable(
  'submissions',
  {
    id: int('id').autoincrement().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    genre: mysqlEnum('genre', submissionGenre).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    synopsis: text('synopsis').notNull(),
    /** Object storage key, not a public URL. Manuscripts are never publicly readable. */
    manuscriptFileKey: varchar('manuscript_file_key', { length: 512 }),
    manuscriptFileName: varchar('manuscript_file_name', { length: 255 }),
    status: mysqlEnum('status', submissionStatus).notNull().default('new'),
    /** Admin-only reviewer notes. Never returned on a public endpoint. */
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index('submissions_status_created_idx').on(t.status, t.createdAt)],
);

/** Editorial pages: About, Submissions copy, policies. MDX body. */
export const pages = mysqlTable(
  'pages',
  {
    id: int('id').autoincrement().primaryKey(),
    slug: varchar('slug', { length: 160 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    bodyMdx: text('body_mdx').notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 320 }),
    publishedAt: timestamp('published_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex('pages_slug_idx').on(t.slug)],
);

/**
 * Legacy URL map, editable in admin.
 *
 * Covers both the old WooCommerce /product/* paths on zhspress.org and every
 * light4ph.org path once that domain is repointed here. Losing these means
 * losing the magazine's existing search presence.
 */
export const redirects = mysqlTable(
  'redirects',
  {
    id: int('id').autoincrement().primaryKey(),
    /** Path only, leading slash, no host, no query. */
    fromPath: varchar('from_path', { length: 512 }).notNull(),
    toPath: varchar('to_path', { length: 512 }).notNull(),
    statusCode: int('status_code').notNull().default(301),
    note: varchar('note', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('redirects_from_path_idx').on(t.fromPath)],
);

export const media = mysqlTable(
  'media',
  {
    id: int('id').autoincrement().primaryKey(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    url: varchar('url', { length: 512 }).notNull(),
    alt: varchar('alt', { length: 320 }),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    width: int('width', { unsigned: true }),
    height: int('height', { unsigned: true }),
    sizeBytes: int('size_bytes', { unsigned: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('media_storage_key_idx').on(t.storageKey)],
);

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  product: one(products, { fields: [waitlistEntries.productId], references: [products.id] }),
}));
