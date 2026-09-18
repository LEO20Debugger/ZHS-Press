/**
 * Response shapes returned by the API and consumed by the web app.
 *
 * These are the public projection of the database rows — deliberately not the
 * rows themselves. Internal notes, cost fields and raw payment payloads must
 * never leak into a storefront response, and keeping the projection explicit
 * is what stops that happening by accident when a column is added.
 */

import type { Currency } from './money';

export type ProductType = 'book' | 'magazine' | 'stationery';
/** Coarse stock, as the storefront is allowed to know it. */
export type StockLevel = 'in_stock' | 'low' | 'out';

/** At or below this many remaining, a title is advertised as running low. */
export const LOW_STOCK_THRESHOLD = 5;

export type ProductStatus ='draft' | 'coming_soon' | 'available' | 'sold_out' | 'archived';

export interface ProductImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** The per-title colour and the text colour that is readable on it. */
export interface AccentPairing {
  accent: string;
  tint: string;
  /** Whichever of --ink / --paper-raised passes contrast on `accent`. */
  foreground: string;
}

export interface ProductSummary {
  id: number;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currency: Currency;
  releaseDate: string | null;
  amazonUrl: string | null;
  accent: AccentPairing | null;
  featured: boolean;
  coverImage: ProductImage | null;
  /** Denormalised for listing cards: the author, issue number or cover artist. */
  attribution: string | null;
  purchasable: boolean;
  /**
   * How much is left, coarsely.
   *
   * Deliberately not the raw count. Catalogue responses are cached for a
   * minute, so a precise figure is a promise that can already be broken by the
   * time it is read — and a *high* count works against a small press anyway:
   * "247 in stock" says nobody is buying this. Three buckets degrade
   * gracefully under staleness; an integer does not.
   *
   * Untracked stock and backorderable titles both report `in_stock`. Neither
   * has a shelf that can run out from the shopper's point of view.
   */
  stockLevel: StockLevel;
  /**
   * The count behind a `low` level, and null at every other level.
   *
   * "Only 3 left" earns its place on a product page, where it is a real nudge
   * at the moment of deciding. Anything above the threshold stays private, so
   * the field cannot be polled to infer how fast a title sells.
   */
  stockRemaining: number | null;
}

export interface BookDetail {
  authorName: string;
  illustratorName: string | null;
  isbn: string | null;
  pageCount: number | null;
  format: string | null;
  ageRange: string | null;
}

export interface IssueDetail {
  issueNumber: number;
  theme: string | null;
  editorNote: string | null;
  publishedDate: string | null;
  /** Whether this issue is the one the magazine page leads with. */
  isLatest: boolean;
  /** Last day it stays the headline, inclusive. NULL means indefinitely. */
  latestUntil: string | null;
  contributors: Array<{ name: string; slug: string; pieceTitle: string | null }>;
}

export interface StationeryDetail {
  dimensions: string | null;
  material: string | null;
  pageCount: number | null;
  coverArtist: string | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  images: ProductImage[];
  book: BookDetail | null;
  issue: IssueDetail | null;
  stationery: StationeryDetail | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CartLine {
  productId: number;
  slug: string;
  title: string;
  type: ProductType;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  coverImage: ProductImage | null;
}

export interface CartView {
  lines: CartLine[];
  subtotalCents: number;
  currency: Currency;
  itemCount: number;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';

export interface OrderLineView {
  titleSnapshot: string;
  slugSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

/**
 * The public view of an order, addressed by orderNumber.
 *
 * Deliberately excludes internalNote, the raw provider payload and the numeric
 * order id — the confirmation page is reachable by anyone holding the link.
 */
export interface OrderView {
  orderNumber: string;
  status: OrderStatus;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: Currency;
  items: OrderLineView[];
  createdAt: string;
  paidAt: string | null;
}

export interface CheckoutSession {
  orderNumber: string;
  /** Flutterwave-hosted payment page. The browser is sent here. */
  paymentLink: string;
}
