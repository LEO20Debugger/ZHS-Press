import { describe, expect, it } from 'vitest';
import { CheckoutService } from './checkout.service';

/**
 * Branch tests for settlePayment.
 *
 * These cover the decision logic — which writes are allowed to happen for a
 * given verified transaction — using a stub that records every table written
 * to. They do NOT prove MySQL's concurrency semantics; the atomic-claim
 * behaviour under real concurrent delivery is covered by the integration test
 * in settle-payment.integration.test.ts, which needs a database.
 *
 * The assertion that matters most in here is negative: on any mismatch, the
 * orders table must never be written.
 */

interface StubState {
  payment: Record<string, unknown> | undefined;
  order: Record<string, unknown> | undefined;
  items: Array<Record<string, unknown>>;
  /** Rows affected by the conditional claim UPDATE on payments. */
  claimAffected: number;
  writes: string[];
}

function makeStubDb(state: StubState) {
  const recordUpdate = (table: string, affected: number) => {
    state.writes.push(`update:${table}`);
    return {
      set: () => ({
        where: async () => ({ affectedRows: affected }),
      }),
    };
  };

  const tableNameOf = (table: unknown): string => {
    const symbols = Object.getOwnPropertySymbols(table as object);
    for (const symbol of symbols) {
      if (String(symbol).includes('Name')) {
        return String((table as Record<symbol, unknown>)[symbol]);
      }
    }
    return 'unknown';
  };

  const api: Record<string, unknown> = {
    query: {
      payments: { findFirst: async () => state.payment },
      orders: { findFirst: async () => state.order },
      orderItems: { findMany: async () => state.items },
    },
    update: (table: unknown) => {
      const name = tableNameOf(table);
      return recordUpdate(name, name === 'payments' ? state.claimAffected : 1);
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
  };

  return api;
}

function makeService(state: StubState): CheckoutService {
  const db = makeStubDb(state);
  return new CheckoutService(
    db as never,
    { view: async () => ({ lines: [] }) } as never,
    {} as never,
    { get: () => 'http://localhost:3000' } as never,
  );
}

const ORDER = { id: 1, orderNumber: 'ZHS-TEST01', totalCents: 6349, currency: 'USD' };
const PAYMENT = { id: 10, orderId: 1, txRef: 'ZHS-TEST01-abc', status: 'initiated' };

function baseState(overrides: Partial<StubState> = {}): StubState {
  return {
    payment: { ...PAYMENT },
    order: { ...ORDER },
    items: [{ productId: 5, quantity: 2 }],
    claimAffected: 1,
    writes: [],
    ...overrides,
  };
}

const VERIFIED = {
  txRef: 'ZHS-TEST01-abc',
  providerTxId: '998877',
  amountCents: 6349,
  currency: 'USD',
  successful: true,
  raw: {},
};

describe('settlePayment', () => {
  it('ignores a webhook for a tx_ref we never issued, writing nothing', async () => {
    const state = baseState({ payment: undefined });
    const result = await makeService(state).settlePayment(VERIFIED);

    expect(result).toEqual({ handled: false, reason: 'unknown_reference' });
    expect(state.writes).toEqual([]);
  });

  it('marks the payment failed but never the order paid when the amount is short', async () => {
    const state = baseState();
    const result = await makeService(state).settlePayment({ ...VERIFIED, amountCents: 6348 });

    expect(result).toEqual({ handled: false, reason: 'amount_mismatch' });
    expect(state.writes).toContain('update:payments');
    expect(state.writes).not.toContain('update:orders');
    expect(state.writes).not.toContain('update:inventory');
  });

  it('rejects an overpayment rather than accepting it as good enough', async () => {
    const state = baseState();
    const result = await makeService(state).settlePayment({ ...VERIFIED, amountCents: 99999 });

    expect(result.reason).toBe('amount_mismatch');
    expect(state.writes).not.toContain('update:orders');
  });

  it('rejects the right number in the wrong currency', async () => {
    // 6349 NGN is not 6349 USD. Without the currency half of the assertion this
    // order would ship for roughly four dollars.
    const state = baseState();
    const result = await makeService(state).settlePayment({ ...VERIFIED, currency: 'NGN' });

    expect(result.reason).toBe('amount_mismatch');
    expect(state.writes).not.toContain('update:orders');
    expect(state.writes).not.toContain('update:inventory');
  });

  it('records a failed transaction without touching the order', async () => {
    const state = baseState();
    const result = await makeService(state).settlePayment({ ...VERIFIED, successful: false });

    expect(result).toEqual({ handled: true, reason: 'not_successful' });
    expect(state.writes).toContain('update:payments');
    expect(state.writes).not.toContain('update:orders');
  });

  it('stops when the payment was already claimed, leaving stock alone', async () => {
    // This is the redelivery case: the conditional UPDATE affects zero rows
    // because another delivery already settled it. No second decrement.
    const state = baseState({ claimAffected: 0 });
    const result = await makeService(state).settlePayment(VERIFIED);

    expect(result).toEqual({ handled: true, reason: 'already_settled' });
    expect(state.writes).not.toContain('update:orders');
    expect(state.writes).not.toContain('update:inventory');
  });

  it('marks paid and adjusts stock on a clean first delivery', async () => {
    const state = baseState();
    const result = await makeService(state).settlePayment(VERIFIED);

    expect(result).toEqual({ handled: true });
    expect(state.writes).toContain('update:payments');
    expect(state.writes).toContain('update:orders');
    expect(state.writes).toContain('update:inventory');
  });
});
