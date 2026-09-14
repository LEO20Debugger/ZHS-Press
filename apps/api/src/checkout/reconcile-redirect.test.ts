import { describe, expect, it } from 'vitest';
import { CheckoutService } from './checkout.service';

/**
 * Branch tests for reconcileFromRedirect.
 *
 * This path is reachable by anyone who knows an order number, and the
 * transaction id it acts on arrives in a URL. So the assertions that matter
 * here are the negative ones: which inputs must NOT result in a write to the
 * orders table.
 *
 * Settlement itself is covered by settle-payment.test.ts; these tests only
 * check what reaches it.
 */

interface StubState {
  payment: Record<string, unknown> | undefined;
  order: Record<string, unknown> | undefined;
  writes: string[];
  /** Transaction ids reconcile actually asked Flutterwave about. */
  verified: string[];
  verifyResult: Record<string, unknown>;
  verifyThrows?: Error;
}

const ORDER_ID = 7;

function makeOrder(status: string) {
  return {
    id: ORDER_ID,
    orderNumber: 'ZHS-TEST01',
    status,
    email: 'reader@example.com',
    subtotalCents: 2998,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 2998,
    currency: 'USD',
    createdAt: new Date('2026-09-14T10:00:00Z'),
    paidAt: status === 'paid' ? new Date('2026-09-14T10:01:00Z') : null,
  };
}

function makeService(state: StubState): CheckoutService {
  const tableNameOf = (table: unknown): string => {
    for (const symbol of Object.getOwnPropertySymbols(table as object)) {
      if (String(symbol).includes('Name')) {
        return String((table as Record<symbol, unknown>)[symbol]);
      }
    }
    return 'unknown';
  };

  const db: Record<string, unknown> = {
    query: {
      payments: { findFirst: async () => state.payment },
      orders: { findFirst: async () => state.order },
      orderItems: { findMany: async () => [] },
    },
    update: (table: unknown) => {
      state.writes.push(`update:${tableNameOf(table)}`);
      return { set: () => ({ where: async () => ({ affectedRows: 1 }) }) };
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  const flutterwave = {
    verifyTransaction: async (id: string) => {
      state.verified.push(id);
      if (state.verifyThrows) throw state.verifyThrows;
      return state.verifyResult;
    },
  };

  return new CheckoutService(
    db as never,
    { view: async () => ({ lines: [] }) } as never,
    flutterwave as never,
    { get: () => 'http://localhost:3000' } as never,
    { send: async () => ({ sent: true }) } as never,
  );
}

function baseState(overrides: Partial<StubState> = {}): StubState {
  return {
    payment: { id: 1, orderId: ORDER_ID, txRef: 'ZHS-TEST01-abc', status: 'initiated' },
    order: makeOrder('pending'),
    writes: [],
    verified: [],
    verifyResult: {
      txRef: 'ZHS-TEST01-abc',
      providerTxId: '8832011',
      amountCents: 2998,
      currency: 'USD',
      successful: true,
      raw: {},
    },
    ...overrides,
  };
}

describe('reconcileFromRedirect', () => {
  it('settles a pending order whose transaction verifies', async () => {
    const state = baseState();
    const order = await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.verified).toEqual(['8832011']);
    expect(state.writes).toContain('update:orders');
    expect(order.orderNumber).toBe('ZHS-TEST01');
  });

  it('does not call Flutterwave when the order is already settled', async () => {
    // Anyone holding an order number can hit this endpoint. Without the early
    // return, reloading the page would drive outbound requests at the provider.
    const state = baseState({ order: makeOrder('paid') });
    await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.verified).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  it('ignores a transaction belonging to a different order', async () => {
    // Real, successful, and somebody else's. Settling on it would mark this
    // order paid against a stranger's money.
    const state = baseState({
      payment: { id: 99, orderId: ORDER_ID + 1, txRef: 'ZHS-OTHER-xyz', status: 'initiated' },
      verifyResult: {
        txRef: 'ZHS-OTHER-xyz',
        providerTxId: '9999999',
        amountCents: 2998,
        currency: 'USD',
        successful: true,
        raw: {},
      },
    });

    await makeService(state).reconcileFromRedirect('ZHS-TEST01', '9999999');

    expect(state.writes).toEqual([]);
  });

  it('ignores a transaction reference we never issued', async () => {
    const state = baseState({ payment: undefined });
    await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.writes).toEqual([]);
  });

  it('leaves the order pending when the lookup fails', async () => {
    // A failed lookup is not a failed payment — the webhook may still land.
    const state = baseState({ verifyThrows: new Error('network down') });
    const order = await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.writes).toEqual([]);
    expect(order.status).toBe('pending');
  });

  it('records failure without touching the order when payment did not succeed', async () => {
    const state = baseState({
      verifyResult: {
        txRef: 'ZHS-TEST01-abc',
        providerTxId: '8832011',
        amountCents: 2998,
        currency: 'USD',
        successful: false,
        raw: {},
      },
    });

    await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.writes).toContain('update:payments');
    expect(state.writes).not.toContain('update:orders');
  });

  it('refuses an amount that does not match the order', async () => {
    const state = baseState({
      verifyResult: {
        txRef: 'ZHS-TEST01-abc',
        providerTxId: '8832011',
        amountCents: 1,
        currency: 'USD',
        successful: true,
        raw: {},
      },
    });

    await makeService(state).reconcileFromRedirect('ZHS-TEST01', '8832011');

    expect(state.writes).not.toContain('update:orders');
  });

  it('throws when the order does not exist', async () => {
    const state = baseState({ order: undefined });

    await expect(
      makeService(state).reconcileFromRedirect('ZHS-NOPE', '8832011'),
    ).rejects.toThrow(/not found/i);
  });
});
