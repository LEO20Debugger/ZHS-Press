import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { sessionIdToSettle } from '../checkout/webhook.controller';
import { PAYMENT_SOURCE, StripeService, toVerifiedTransaction } from './stripe.service';

const WEBHOOK_SECRET = 'whsec_test_secret';

function makeService(overrides: Record<string, string | undefined> = {}): StripeService {
  const values: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...overrides,
  };
  return new StripeService({ get: (key: string) => values[key] } as never);
}

function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_abc',
    object: 'checkout.session',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 2998,
    currency: 'usd',
    client_reference_id: 'ZHS-ABC123-deadbeef',
    payment_intent: 'pi_123',
    metadata: { source: PAYMENT_SOURCE, order_number: 'ZHS-ABC123', tx_ref: 'ZHS-ABC123-deadbeef' },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe('generateTxRef', () => {
  it('is unique per call and keeps the order number readable', () => {
    const refs = new Set(
      Array.from({ length: 500 }, () => StripeService.generateTxRef('ZHS-ABC123')),
    );
    expect(refs.size).toBe(500);
    for (const ref of refs) expect(ref).toMatch(/^ZHS-ABC123-[0-9a-f]{16}$/);
  });
});

describe('toVerifiedTransaction', () => {
  it('maps a paid session, upper-casing the currency', () => {
    expect(toVerifiedTransaction(session())).toMatchObject({
      providerTxId: 'pi_123',
      txRef: 'ZHS-ABC123-deadbeef',
      amountCents: 2998,
      currency: 'USD',
      successful: true,
    });
  });

  it('reads the PaymentIntent id when it was expanded', () => {
    const result = toVerifiedTransaction(
      session({ payment_intent: { id: 'pi_456', status: 'succeeded' } as Stripe.PaymentIntent }),
    );
    expect(result?.providerTxId).toBe('pi_456');
  });

  it('treats an expired session as failed', () => {
    const result = toVerifiedTransaction(
      session({ status: 'expired', payment_status: 'unpaid', payment_intent: null }),
    );
    expect(result).toMatchObject({ successful: false, providerTxId: 'cs_test_abc' });
  });

  it('treats a declined delayed payment as failed', () => {
    const result = toVerifiedTransaction(
      session({
        payment_status: 'unpaid',
        payment_intent: { id: 'pi_789', status: 'requires_payment_method' } as Stripe.PaymentIntent,
      }),
    );
    expect(result?.successful).toBe(false);
  });

  it('leaves a delayed payment still in flight undecided', () => {
    // Recording this as a failure would be wrong: the money may yet arrive.
    const result = toVerifiedTransaction(
      session({
        payment_status: 'unpaid',
        payment_intent: { id: 'pi_789', status: 'processing' } as Stripe.PaymentIntent,
      }),
    );
    expect(result).toBeNull();
  });

  it('leaves an open session undecided', () => {
    expect(toVerifiedTransaction(session({ status: 'open', payment_status: 'unpaid' }))).toBeNull();
  });

  it("ignores the other business's sessions on the shared account", () => {
    expect(toVerifiedTransaction(session({ metadata: {} }))).toBeNull();
    expect(toVerifiedTransaction(session({ metadata: null }))).toBeNull();
  });
});

describe('sessionIdToSettle', () => {
  const event = (type: string, object: Partial<Stripe.Checkout.Session>) =>
    ({ type, data: { object } }) as unknown as Stripe.Event;

  it('picks out our completed, async and expired sessions', () => {
    for (const type of [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ]) {
      expect(sessionIdToSettle(event(type, session()))).toBe('cs_test_abc');
    }
  });

  it("ignores sessions without this shop's tag", () => {
    expect(
      sessionIdToSettle(event('checkout.session.completed', session({ metadata: {} }))),
    ).toBeNull();
  });

  it('ignores event types that cannot settle an order', () => {
    expect(sessionIdToSettle(event('payment_intent.succeeded', session()))).toBeNull();
    expect(sessionIdToSettle(event('charge.refunded', session()))).toBeNull();
  });
});

describe('constructEvent', () => {
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: session() },
  });
  const signed = (secret: string) =>
    Stripe.webhooks.generateTestHeaderString({ payload, secret });

  it('accepts a body signed with the endpoint secret', () => {
    const event = makeService().constructEvent(Buffer.from(payload), signed(WEBHOOK_SECRET));
    expect(event?.id).toBe('evt_1');
  });

  it('rejects a body signed with a different secret', () => {
    expect(
      makeService().constructEvent(Buffer.from(payload), signed('whsec_someone_else')),
    ).toBeNull();
  });

  it('rejects a body altered after signing', () => {
    const header = signed(WEBHOOK_SECRET);
    const tampered = payload.replace('2998', '1');
    expect(makeService().constructEvent(Buffer.from(tampered), header)).toBeNull();
  });

  it('rejects a missing signature or body', () => {
    expect(makeService().constructEvent(Buffer.from(payload), undefined)).toBeNull();
    expect(makeService().constructEvent(undefined, signed(WEBHOOK_SECRET))).toBeNull();
  });

  it('refuses to run without a webhook secret', () => {
    expect(() =>
      makeService({ STRIPE_WEBHOOK_SECRET: undefined }).constructEvent(
        Buffer.from(payload),
        signed(WEBHOOK_SECRET),
      ),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });
});
