import { describe, expect, it } from 'vitest';
import { deletionBlockedReason, isTestPayment } from './order-deletion';

const sandbox = { status: 'successful', rawPayload: { object: 'checkout.session', livemode: false } };
const live = { status: 'successful', rawPayload: { object: 'checkout.session', livemode: true } };

describe('deletionBlockedReason', () => {
  it('allows orders nobody paid for', () => {
    for (const status of ['pending', 'failed', 'cancelled']) {
      expect(deletionBlockedReason({ status }, [])).toBeNull();
    }
  });

  it('allows a sandbox order, paid or fulfilled', () => {
    expect(deletionBlockedReason({ status: 'paid' }, [sandbox])).toBeNull();
    expect(deletionBlockedReason({ status: 'fulfilled' }, [sandbox])).toBeNull();
  });

  it('refuses a real paid order', () => {
    expect(deletionBlockedReason({ status: 'paid' }, [live])).toMatch(/refund it in Stripe/);
    expect(deletionBlockedReason({ status: 'fulfilled' }, [live])).not.toBeNull();
    expect(deletionBlockedReason({ status: 'refunded' }, [live])).not.toBeNull();
  });

  it('refuses when real and sandbox payments are mixed', () => {
    // Any real money on the order makes it a record worth keeping.
    expect(deletionBlockedReason({ status: 'paid' }, [sandbox, live])).not.toBeNull();
  });

  it('refuses a paid order with no payment proving it was a test', () => {
    // Guessing "test" wrongly would delete a genuine sale.
    expect(deletionBlockedReason({ status: 'paid' }, [])).not.toBeNull();
    expect(
      deletionBlockedReason({ status: 'paid' }, [{ status: 'successful', rawPayload: { id: 123 } }]),
    ).not.toBeNull();
  });
});

describe('isTestPayment', () => {
  it('is true only for an explicit livemode: false', () => {
    expect(isTestPayment({ livemode: false })).toBe(true);
    expect(isTestPayment({ livemode: true })).toBe(false);
    expect(isTestPayment({})).toBe(false);
    expect(isTestPayment(null)).toBe(false);
    expect(isTestPayment('{"livemode":false}')).toBe(false);
  });
});
