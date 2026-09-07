/**
 * Money handling.
 *
 * Every amount in this system is an integer number of minor units (cents).
 * There are no floats and no decimal strings in the domain — they are only
 * produced at the display boundary by `formatMoney`, and only accepted at the
 * input boundary by `parseMoneyToCents` (admin price entry).
 *
 * This is the whole reason the schema stores `price_cents` rather than a
 * DECIMAL: 0.1 + 0.2 problems in a shopping cart become customer refunds.
 */

export const SUPPORTED_CURRENCIES = ['USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'USD';

/**
 * Formats cents for display, e.g. 1499 -> "$14.99".
 *
 * @param locale Defaults to en-US. Prices are USD-only at launch (brief, s3).
 */
export function formatMoney(
  cents: number,
  currency: Currency = DEFAULT_CURRENCY,
  locale = 'en-US',
): string {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`formatMoney expects integer cents, received ${cents}`);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Parses admin price input ("14.99", "$14.99", "14") into integer cents.
 *
 * Returns null rather than throwing, so callers can surface a field-level
 * validation message. Rejects more than two decimal places instead of
 * silently rounding — a price typed as "14.999" is a mistake worth showing.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return null;

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [whole, fraction = ''] = cleaned.split('.');
  const paddedFraction = fraction.padEnd(2, '0');

  const cents = Number(whole) * 100 + Number(paddedFraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Guards amounts crossing a trust boundary before they reach the database. */
export function assertValidCents(value: number, label = 'amount'): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of cents, received ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must not be negative, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
  return value;
}
