import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoneyToCents } from './money';
import { calculateOrderTotals, paymentMatchesOrder, quoteShipping } from './pricing';

describe('formatMoney', () => {
  it('formats cents as USD', () => {
    expect(formatMoney(1499)).toBe('$14.99');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(100000)).toBe('$1,000.00');
  });

  it('refuses non-integer input rather than rounding it', () => {
    expect(() => formatMoney(14.99)).toThrow(TypeError);
  });
});

describe('parseMoneyToCents', () => {
  it('parses the shapes an admin actually types', () => {
    expect(parseMoneyToCents('14.99')).toBe(1499);
    expect(parseMoneyToCents('$14.99')).toBe(1499);
    expect(parseMoneyToCents(' 14 ')).toBe(1400);
    expect(parseMoneyToCents('14.9')).toBe(1490);
    expect(parseMoneyToCents('1,299.50')).toBe(129950);
    expect(parseMoneyToCents('0')).toBe(0);
  });

  it('rejects rather than silently rounding excess precision', () => {
    // "14.999" is a typo, and rounding it to $15.00 hides that.
    expect(parseMoneyToCents('14.999')).toBeNull();
  });

  it('rejects junk and negatives', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('free')).toBeNull();
    expect(parseMoneyToCents('-5.00')).toBeNull();
    expect(parseMoneyToCents('12.3.4')).toBeNull();
  });

  it('round-trips through formatMoney', () => {
    for (const input of ['0.99', '14.99', '1250.00']) {
      const cents = parseMoneyToCents(input);
      expect(cents).not.toBeNull();
      expect(parseMoneyToCents(formatMoney(cents as number))).toBe(cents);
    }
  });
});

describe('quoteShipping', () => {
  it('charges the flat rate below the free threshold', () => {
    expect(quoteShipping(2000, { rateCents: 599, freeOverCents: 5000 })).toBe(599);
  });

  it('is free at and above the threshold', () => {
    expect(quoteShipping(5000, { rateCents: 599, freeOverCents: 5000 })).toBe(0);
    expect(quoteShipping(9999, { rateCents: 599, freeOverCents: 5000 })).toBe(0);
  });

  it('always charges when no threshold is configured', () => {
    expect(quoteShipping(100000, { rateCents: 599, freeOverCents: null })).toBe(599);
    expect(quoteShipping(100000, { rateCents: 599 })).toBe(599);
  });
});

describe('calculateOrderTotals', () => {
  const book = { productId: 1, unitPriceCents: 1499, quantity: 1 };
  const issue = { productId: 2, unitPriceCents: 1200, quantity: 2 };
  const journal = { productId: 3, unitPriceCents: 2450, quantity: 1 };

  it('totals a mixed cart of a book, two issues and a journal', () => {
    const totals = calculateOrderTotals([book, issue, journal]);

    expect(totals.lines.map((l) => l.lineTotalCents)).toEqual([1499, 2400, 2450]);
    expect(totals.subtotalCents).toBe(6349);
    expect(totals.shippingCents).toBe(0);
    expect(totals.taxCents).toBe(0);
    expect(totals.totalCents).toBe(6349);
    expect(totals.currency).toBe('USD');
  });

  it('adds shipping to the total', () => {
    const totals = calculateOrderTotals([book], {
      shipping: { rateCents: 599, freeOverCents: 5000 },
    });
    expect(totals.subtotalCents).toBe(1499);
    expect(totals.shippingCents).toBe(599);
    expect(totals.totalCents).toBe(2098);
  });

  it('stays exact across many lines where floats would drift', () => {
    // 0.1 + 0.2 in float dollars is the bug this schema exists to avoid.
    const lines = Array.from({ length: 100 }, (_, i) => ({
      productId: i,
      unitPriceCents: 1,
      quantity: 3,
    }));
    expect(calculateOrderTotals(lines).totalCents).toBe(300);
  });

  it('refuses an empty order', () => {
    expect(() => calculateOrderTotals([])).toThrow(/empty order/);
  });

  it('refuses a zero or negative quantity', () => {
    expect(() => calculateOrderTotals([{ ...book, quantity: 0 }])).toThrow(RangeError);
    expect(() => calculateOrderTotals([{ ...book, quantity: -1 }])).toThrow(RangeError);
  });

  it('refuses a fractional quantity', () => {
    expect(() => calculateOrderTotals([{ ...book, quantity: 1.5 }])).toThrow(RangeError);
  });

  it('refuses a non-integer or negative unit price', () => {
    expect(() => calculateOrderTotals([{ ...book, unitPriceCents: 14.99 }])).toThrow(TypeError);
    expect(() => calculateOrderTotals([{ ...book, unitPriceCents: -100 }])).toThrow(RangeError);
  });
});

describe('paymentMatchesOrder', () => {
  const order = { totalCents: 6349, currency: 'USD' };

  it('accepts an exact match', () => {
    expect(paymentMatchesOrder(order, { amountCents: 6349, currency: 'USD' })).toBe(true);
  });

  it('is case-insensitive on the currency code only', () => {
    expect(paymentMatchesOrder(order, { amountCents: 6349, currency: 'usd' })).toBe(true);
  });

  it('rejects an underpayment, even by one cent', () => {
    expect(paymentMatchesOrder(order, { amountCents: 6348, currency: 'USD' })).toBe(false);
  });

  it('rejects an overpayment rather than treating it as good enough', () => {
    // An overpayment means something is wrong with the flow; it is not a pass.
    expect(paymentMatchesOrder(order, { amountCents: 9999, currency: 'USD' })).toBe(false);
  });

  it('rejects a payment in the wrong currency for the same number', () => {
    // 6349 NGN is not 6349 USD. This is the check that matters most.
    expect(paymentMatchesOrder(order, { amountCents: 6349, currency: 'NGN' })).toBe(false);
  });

  it('rejects a non-integer amount from the provider', () => {
    expect(paymentMatchesOrder(order, { amountCents: 63.49, currency: 'USD' })).toBe(false);
  });
});
