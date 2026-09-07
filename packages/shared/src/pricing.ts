/**
 * Order total calculation.
 *
 * Lives in shared so the storefront can display a total that matches, but the
 * API is the only authority: checkout re-reads live prices from the database
 * and recomputes from scratch. A total submitted by a client is never trusted,
 * and never even read.
 */

import { assertValidCents, DEFAULT_CURRENCY, type Currency } from './money';

export interface PriceableLine {
  productId: number;
  /** Authoritative unit price, read from the database at checkout time. */
  unitPriceCents: number;
  quantity: number;
}

export interface OrderLine extends PriceableLine {
  lineTotalCents: number;
}

export interface OrderTotals {
  lines: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: Currency;
}

export interface ShippingQuote {
  rateCents: number;
  /** Subtotal at or above which shipping is free. Null disables the threshold. */
  freeOverCents?: number | null;
}

/**
 * The flat-rate launch implementation of shipping (brief s3: fulfilment TBC).
 *
 * A real placeholder, not a stub — checkout works end to end on it. Swapping in
 * a carrier-rated provider later replaces this function alone.
 */
export function quoteShipping(subtotalCents: number, quote: ShippingQuote): number {
  assertValidCents(subtotalCents, 'subtotal');
  assertValidCents(quote.rateCents, 'shipping rate');

  if (quote.freeOverCents != null && subtotalCents >= quote.freeOverCents) {
    return 0;
  }
  return quote.rateCents;
}

/**
 * Computes an order's totals from authoritative line prices.
 *
 * Note the ordering: every line is validated before anything is summed, so a
 * single bad line fails the whole calculation rather than producing a
 * plausible-looking wrong total.
 */
export function calculateOrderTotals(
  lines: PriceableLine[],
  options: {
    shipping?: ShippingQuote;
    /** Zero at launch. The parameter exists so enabling tax is not a refactor. */
    taxCents?: number;
    currency?: Currency;
  } = {},
): OrderTotals {
  if (lines.length === 0) {
    throw new Error('Cannot calculate totals for an empty order');
  }

  const priced: OrderLine[] = lines.map((line) => {
    assertValidCents(line.unitPriceCents, `unit price for product ${line.productId}`);

    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError(
        `Quantity for product ${line.productId} must be a positive integer, ` +
          `received ${line.quantity}`,
      );
    }

    return { ...line, lineTotalCents: line.unitPriceCents * line.quantity };
  });

  const subtotalCents = priced.reduce((sum, line) => sum + line.lineTotalCents, 0);
  assertValidCents(subtotalCents, 'subtotal');

  const shippingCents = options.shipping ? quoteShipping(subtotalCents, options.shipping) : 0;
  const taxCents = options.taxCents ?? 0;
  assertValidCents(taxCents, 'tax');

  const totalCents = subtotalCents + shippingCents + taxCents;
  assertValidCents(totalCents, 'total');

  return {
    lines: priced,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    currency: options.currency ?? DEFAULT_CURRENCY,
  };
}

/**
 * Confirms a provider's reported payment matches what we asked to be charged.
 *
 * This is the check that stops the classic Flutterwave failure: a webhook that
 * says "successful" is not evidence that the right amount, in the right
 * currency, was paid against the right order.
 */
export function paymentMatchesOrder(
  order: { totalCents: number; currency: string },
  payment: { amountCents: number; currency: string },
): boolean {
  return (
    Number.isInteger(payment.amountCents) &&
    payment.amountCents === order.totalCents &&
    payment.currency.toUpperCase() === order.currency.toUpperCase()
  );
}
