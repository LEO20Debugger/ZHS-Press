import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendTransport, addressDomain } from './resend-transport';

const MAIL = { subject: 'Test', html: '<p>Hello</p>', text: 'Hello' };

function mockFetch(response: { status: number; body?: unknown }) {
  const spy = vi.fn(async () =>
    new Response(JSON.stringify(response.body ?? {}), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Reads the arguments of a recorded fetch call.
 *
 * `noUncheckedIndexedAccess` is on, so indexing into mock.calls yields
 * `| undefined` — asserting the call happened before reading it is both what
 * satisfies the compiler and a better failure message than "cannot read
 * property of undefined" when a test stops calling fetch at all.
 */
function fetchCall(spy: ReturnType<typeof mockFetch>, index = 0): [string, RequestInit] {
  const call = spy.mock.calls[index];
  expect(call, `expected a fetch call at index ${index}`).toBeDefined();
  return call as unknown as [string, RequestInit];
}

describe('addressDomain', () => {
  it('reads the domain out of a display-name From header', () => {
    expect(addressDomain('ZHS Press <hello@zhspress.org>')).toBe('zhspress.org');
  });

  it('handles a bare address', () => {
    expect(addressDomain('hello@zhspress.org')).toBe('zhspress.org');
  });

  it('lowercases, since domains are case-insensitive but string compare is not', () => {
    expect(addressDomain('A <Hello@ZHSPress.ORG>')).toBe('zhspress.org');
  });

  it('recognises the testing sender', () => {
    expect(addressDomain('ZHS Press <onboarding@resend.dev>')).toBe('resend.dev');
  });

  it('returns null for something that is not an address', () => {
    expect(addressDomain('ZHS Press')).toBeNull();
  });
});

describe('ResendTransport.send', () => {
  it('posts the message to the emails endpoint with bearer auth', async () => {
    const spy = mockFetch({ status: 200, body: { id: 'abc-123' } });

    const result = await new ResendTransport('re_key').send(
      'customer@example.com',
      MAIL,
      'ZHS Press <hello@zhspress.org>',
      'orders@zhspress.org',
    );

    expect(result).toEqual({ ok: true, id: 'abc-123' });

    const [url, init] = fetchCall(spy);
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_key');

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: 'ZHS Press <hello@zhspress.org>',
      to: 'customer@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
      // snake_case — the API rejects replyTo.
      reply_to: 'orders@zhspress.org',
    });
  });

  it('omits reply_to when there is none', async () => {
    const spy = mockFetch({ status: 200, body: { id: 'x' } });
    await new ResendTransport('re_key').send('a@b.com', MAIL, 'c@d.com');

    const body = JSON.parse(fetchCall(spy)[1].body as string);
    expect(body).not.toHaveProperty('reply_to');
  });

  it('surfaces the unverified-domain message verbatim and marks it final', async () => {
    // The exact failure the current Railway config would hit. Passing the
    // provider's wording through is the difference between "email is broken"
    // and a one-line fix.
    mockFetch({
      status: 403,
      body: {
        name: 'validation_error',
        message: 'The zhspress.org domain is not verified. Please, add and verify your domain.',
      },
    });

    const result = await new ResendTransport('re_key').send('a@b.com', MAIL, 'x@zhspress.org');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('zhspress.org domain is not verified');
    // A 403 will fail identically forever; retrying is pointless.
    expect(result.retryable).toBe(false);
  });

  it('surfaces the testing-recipient restriction', async () => {
    mockFetch({
      status: 403,
      body: {
        message:
          'You can only send testing emails to your own email address (you@gmail.com).',
      },
    });

    const result = await new ResendTransport('re_key').send('someone@else.com', MAIL, 'x@y.com');
    expect(result.error).toContain('your own email address');
    expect(result.retryable).toBe(false);
  });

  it('marks rate limiting and provider faults as retryable', async () => {
    for (const status of [429, 500, 503]) {
      mockFetch({ status, body: { message: 'nope' } });
      const result = await new ResendTransport('re_key').send('a@b.com', MAIL, 'c@d.com');
      expect(result.retryable, `status ${status}`).toBe(true);
    }
  });

  it('never throws when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND api.resend.com');
      }),
    );

    // The payment webhook calls this. A throw here would fail the webhook for
    // an order that already settled, and Flutterwave would redeliver it.
    const result = await new ResendTransport('re_key').send('a@b.com', MAIL, 'c@d.com');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ENOTFOUND');
    expect(result.retryable).toBe(true);
  });

  it('gives up on a hung provider rather than hanging with it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      ),
    );

    const result = await new ResendTransport('re_key').send('a@b.com', MAIL, 'c@d.com', undefined, 40);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.retryable).toBe(true);
  });

  it('copes with a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })),
    );

    const result = await new ResendTransport('re_key').send('a@b.com', MAIL, 'c@d.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('HTTP 502');
  });
});

describe('ResendTransport.verify', () => {
  it('rejects an invalid key, which the live API reports as 400 and not 401', async () => {
    /*
     * This exact response was captured from api.resend.com. An earlier version
     * keyed off the status code alone, treated anything that was not 401 as a
     * restricted key, and cheerfully reported a revoked key as healthy at boot
     * — after which every send failed.
     */
    mockFetch({
      status: 400,
      body: { statusCode: 400, message: 'API key is invalid', name: 'validation_error' },
    });

    const result = await new ResendTransport('re_bad').verify();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('API key is invalid');
  });

  it('still rejects a 401, whatever the body says', async () => {
    mockFetch({ status: 401, body: {} });
    expect((await new ResendTransport('re_bad').verify()).ok).toBe(false);
  });

  it('returns only the verified domains', async () => {
    mockFetch({
      status: 200,
      body: {
        data: [
          { name: 'zhspress.org', status: 'not_started' },
          { name: 'light4ph.org', status: 'verified' },
        ],
      },
    });

    const result = await new ResendTransport('re_key').verify();
    expect(result.ok).toBe(true);
    // A pending domain is not a sending domain.
    expect(result.domains).toEqual(['light4ph.org']);
  });

  it('treats a send-only key that cannot list domains as fine', async () => {
    // Restricted keys can send but not read. That is not a misconfiguration.
    mockFetch({ status: 403, body: { message: 'not allowed' } });
    const result = await new ResendTransport('re_key').verify();
    expect(result.ok).toBe(true);
    expect(result.domains).toBeUndefined();
  });
});
