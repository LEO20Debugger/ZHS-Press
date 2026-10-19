import { describe, expect, it } from 'vitest';
import { deletionBlockedReason, isTestPayment } from './order-deletion';

const sandbox = { status: 'successful', provider: 'stripe', rawPayload: { object: 'checkout.session', livemode: false } };
const live = { status: 'successful', provider: 'stripe', rawPayload: { object: 'checkout.session', livemode: true } };
const flutterwave = { status: 'successful', provider: 'flutterwave', rawPayload: { status: 'success', data: { id: 1 } } };

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

  it('allows a Flutterwave-era order, which was only ever test mode', () => {
    expect(deletionBlockedReason({ status: 'paid' }, [flutterwave])).toBeNull();
    expect(deletionBlockedReason({ status: 'fulfilled' }, [flutterwave])).toBeNull();
  });

  it('refuses when real and sandbox payments are mixed', () => {
    // Any real money on the order makes it a record worth keeping.
    expect(deletionBlockedReason({ status: 'paid' }, [sandbox, live])).not.toBeNull();
  });

  it('refuses a paid order with no payment proving it was a test', () => {
    // Guessing "test" wrongly would delete a genuine sale.
    expect(deletionBlockedReason({ status: 'paid' }, [])).not.toBeNull();
    expect(
      deletionBlockedReason({ status: 'paid' }, [{ status: 'successful', provider: 'stripe', rawPayload: { id: 123 } }]),
    ).not.toBeNull();
  });
});

describe('isTestPayment', () => {
  const stripe = (rawPayload: unknown) => isTestPayment({ provider: 'stripe', rawPayload });

  it('is true for Stripe only on an explicit livemode: false', () => {
    expect(stripe({ livemode: false })).toBe(true);
    expect(stripe({ livemode: true })).toBe(false);
    expect(stripe({})).toBe(false);
    expect(stripe(null)).toBe(false);
    expect(stripe('{"livemode":false}')).toBe(false);
  });

  it('is true for any Flutterwave payment', () => {
    expect(isTestPayment({ provider: 'flutterwave', rawPayload: null })).toBe(true);
  });
});
