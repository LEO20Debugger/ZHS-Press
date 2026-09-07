import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { products } from './products';

/**
 * Commerce tables.
 *
 * Two rules run through all of this:
 *
 * 1. Money is an integer number of minor units (cents). Never a float, never a
 *    decimal string parsed at the boundary.
 * 2. Prices are snapshotted into cart_items and order_items at write time. An
 *    order's history must not change when someone edits a product later.
 */

export interface PostalAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export const carts = mysqlTable(
  'carts',
  {
    id: int('id').autoincrement().primaryKey(),
    /** Opaque token held in an httpOnly cookie. The cart is never trusted from the client body. */
    sessionToken: varchar('session_token', { length: 64 }).notNull(),
    email: varchar('email', { length: 320 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => [
    uniqueIndex('carts_session_token_idx').on(t.sessionToken),
    index('carts_expires_at_idx').on(t.expiresAt),
  ],
);

export const cartItems = mysqlTable(
  'cart_items',
  {
    id: int('id').autoincrement().primaryKey(),
    cartId: int('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: int('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: int('quantity', { unsigned: true }).notNull().default(1),
    /**
     * Price at the time of adding, for display continuity only. Checkout
     * always re-reads the live price from `products` before charging.
     */
    unitPriceCents: int('unit_price_cents', { unsigned: true }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('cart_items_cart_product_idx').on(t.cartId, t.productId)],
);

export const orderStatus = [
  'pending',
  'paid',
  'failed',
  'fulfilled',
  'cancelled',
  'refunded',
] as const;

export const orders = mysqlTable(
  'orders',
  {
    id: int('id').autoincrement().primaryKey(),
    /** Human-readable public reference, e.g. ZHS-7F3K9Q. Used in URLs and emails. */
    orderNumber: varchar('order_number', { length: 24 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    status: mysqlEnum('status', orderStatus).notNull().default('pending'),

    subtotalCents: int('subtotal_cents', { unsigned: true }).notNull(),
    shippingCents: int('shipping_cents', { unsigned: true }).notNull().default(0),
    /** Zero at launch. The column exists now so enabling tax is not a migration. */
    taxCents: int('tax_cents', { unsigned: true }).notNull().default(0),
    totalCents: int('total_cents', { unsigned: true }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),

    shippingAddress: json('shipping_address').$type<PostalAddress>(),
    billingAddress: json('billing_address').$type<PostalAddress>(),
    customerNote: text('customer_note'),
    /** Internal, admin-only. Never returned on a public endpoint. */
    internalNote: text('internal_note'),

    paidAt: timestamp('paid_at'),
    fulfilledAt: timestamp('fulfilled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('orders_order_number_idx').on(t.orderNumber),
    index('orders_email_idx').on(t.email),
    index('orders_status_created_idx').on(t.status, t.createdAt),
  ],
);

export const orderItems = mysqlTable(
  'order_items',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /**
     * Nullable and ON DELETE SET NULL: an archived product must not erase or
     * alter historical orders.
     */
    productId: int('product_id').references(() => products.id, { onDelete: 'set null' }),
    /** Snapshots. These are the record of what was actually sold. */
    titleSnapshot: varchar('title_snapshot', { length: 255 }).notNull(),
    slugSnapshot: varchar('slug_snapshot', { length: 160 }).notNull(),
    unitPriceCents: int('unit_price_cents', { unsigned: true }).notNull(),
    quantity: int('quantity', { unsigned: true }).notNull(),
    lineTotalCents: int('line_total_cents', { unsigned: true }).notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const paymentStatus = ['initiated', 'successful', 'failed', 'cancelled'] as const;

export const payments = mysqlTable(
  'payments',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull().default('flutterwave'),
    /**
     * Our own generated reference, sent to the provider as tx_ref.
     *
     * This unique constraint is the idempotency key for the webhook. A
     * redelivered webhook must not produce a second paid order or a second
     * inventory decrement.
     */
    txRef: varchar('tx_ref', { length: 64 }).notNull(),
    /** The provider's own transaction id, known only after payment. */
    providerTxId: varchar('provider_tx_id', { length: 64 }),
    amountCents: int('amount_cents', { unsigned: true }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: mysqlEnum('status', paymentStatus).notNull().default('initiated'),
    /** Full verified provider payload, retained for dispute resolution. */
    rawPayload: json('raw_payload'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex('payments_tx_ref_idx').on(t.txRef),
    index('payments_order_idx').on(t.orderId),
  ],
);

/** Editable in admin. Flat rate per zone is the launch implementation. */
export const shippingRates = mysqlTable(
  'shipping_rates',
  {
    id: int('id').autoincrement().primaryKey(),
    zoneName: varchar('zone_name', { length: 120 }).notNull(),
    /** ISO 3166-1 alpha-2 codes. An empty list marks the catch-all rest-of-world zone. */
    countryCodes: json('country_codes').$type<string[]>().notNull(),
    rateCents: int('rate_cents', { unsigned: true }).notNull(),
    /** Order subtotal at or above which shipping is free. Null disables it. */
    freeOverCents: int('free_over_cents', { unsigned: true }),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('shipping_rates_default_idx').on(t.isDefault)],
);

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
