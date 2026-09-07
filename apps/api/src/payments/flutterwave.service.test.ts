import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FlutterwaveService } from './flutterwave.service';

const SECRET_HASH = 'a-long-shared-secret-hash-value-9f2b';

function makeService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    NODE_ENV: 'test',
    API_PORT: 4000,
    CORS_ORIGINS: ['http://localhost:3000'],
    DATABASE_URL: 'mysql://test',
    WEB_BASE_URL: 'http://localhost:3000',
    FLW_PUBLIC_KEY: 'pk_test',
    FLW_SECRET_KEY: 'sk_test',
    FLW_SECRET_HASH: SECRET_HASH,
    FLW_BASE_URL: 'https://api.flutterwave.com/v3',
    ...overrides,
  };

  const config = { get: (key: string) => values[key] } as never;
  return new FlutterwaveService(config);
}

describe('verifyWebhookSignature', () => {
  const service = makeService();

  it('accepts the configured secret hash', () => {
    expect(service.verifyWebhookSignature(SECRET_HASH)).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(service.verifyWebhookSignature(undefined)).toBe(false);
    expect(service.verifyWebhookSignature('')).toBe(false);
  });

  it('rejects a wrong secret of the same length', () => {
    const wrong = 'b'.repeat(SECRET_HASH.length);
    expect(wrong).toHaveLength(SECRET_HASH.length);
    expect(service.verifyWebhookSignature(wrong)).toBe(false);
  });

  it('rejects a prefix of the real secret without throwing', () => {
    // timingSafeEqual throws on length mismatch; the guard must catch this
    // before it gets there, or the endpoint 500s on every probe.
    expect(() => service.verifyWebhookSignature(SECRET_HASH.slice(0, 10))).not.toThrow();
    expect(service.verifyWebhookSignature(SECRET_HASH.slice(0, 10))).toBe(false);
  });

  it('rejects a longer string that starts with the real secret', () => {
    expect(service.verifyWebhookSignature(`${SECRET_HASH}extra`)).toBe(false);
  });

  it('refuses to run at all when no secret hash is configured', () => {
    // Failing closed matters here: a service that treats "no secret" as
    // "accept everything" lets anyone mark orders paid.
    const unconfigured = makeService({ FLW_SECRET_HASH: undefined });
    expect(() => unconfigured.verifyWebhookSignature('anything')).toThrow(
      /Payments are not configured/,
    );
  });
});

describe('generateTxRef', () => {
  it('embeds the order number and stays unique across calls', () => {
    const refs = new Set(
      Array.from({ length: 500 }, () => FlutterwaveService.generateTxRef('ZHS-ABC123')),
    );
    expect(refs.size).toBe(500);
    for (const ref of refs) expect(ref.startsWith('ZHS-ABC123-')).toBe(true);
  });
});

describe('verifyTransaction', () => {
  const service = makeService();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockVerifyResponse(data: unknown, ok = true) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      json: async () => ({ status: 'success', data }),
    });
  }

  it('converts the provider float amount to integer cents without drift', async () => {
    // 14.99 * 100 is 1498.9999999999998 in IEEE 754. Truncation here would
    // under-charge by a cent and fail every amount assertion downstream.
    mockVerifyResponse({
      id: 998877,
      tx_ref: 'ZHS-ABC123-deadbeef',
      amount: 14.99,
      currency: 'USD',
      status: 'successful',
    });

    const result = await service.verifyTransaction('998877');

    expect(result.amountCents).toBe(1499);
    expect(Number.isInteger(result.amountCents)).toBe(true);
    expect(result.successful).toBe(true);
    expect(result.txRef).toBe('ZHS-ABC123-deadbeef');
    expect(result.providerTxId).toBe('998877');
  });

  it('handles other awkward float amounts exactly', async () => {
    for (const [amount, cents] of [
      [0.29, 29],
      [1.1, 110],
      [63.49, 6349],
      [1234.56, 123456],
    ] as const) {
      mockVerifyResponse({ id: 1, tx_ref: 'x', amount, currency: 'USD', status: 'successful' });
      const result = await service.verifyTransaction('1');
      expect(result.amountCents).toBe(cents);
    }
  });

  it('reports a non-successful transaction as unsuccessful rather than throwing', async () => {
    mockVerifyResponse({
      id: 1,
      tx_ref: 'x',
      amount: 14.99,
      currency: 'USD',
      status: 'failed',
    });

    const result = await service.verifyTransaction('1');
    expect(result.successful).toBe(false);
  });

  it('throws when the provider call itself fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error' }),
    });

    await expect(service.verifyTransaction('1')).rejects.toThrow(/Could not verify/);
  });
});
