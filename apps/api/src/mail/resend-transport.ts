import { Logger } from '@nestjs/common';
import type { Mail } from './templates';

const ENDPOINT = 'https://api.resend.com/emails';

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  /** Provider-supplied reason, already shortened for a log line. */
  error?: string;
  /** True when retrying could plausibly succeed. */
  retryable?: boolean;
}

/**
 * Sends through Resend's HTTPS API rather than SMTP.
 *
 * This exists because Railway blocks outbound SMTP — ports 25, 465, 587 and
 * 2525 — on every plan below Pro, to stop their address space being used for
 * spam. The block manifests as a connection timeout rather than a refusal, so
 * it looks exactly like a wrong hostname and costs the full socket timeout on
 * every attempt.
 *
 * HTTPS on 443 is not blocked anywhere, which makes this the only transport
 * that works on the platform the API actually runs on. SMTP is kept alongside
 * it for local development and for any future move to a host that permits it.
 *
 * Uses global fetch — Node 20+ has it, and adding an SDK for one POST would be
 * a dependency for no gain.
 */
export class ResendTransport {
  private readonly logger = new Logger(ResendTransport.name);

  constructor(private readonly apiKey: string) {}

  /**
   * @param timeoutMs Bounds the request. Without it a hung provider holds the
   *   caller open indefinitely — and one of those callers is the payment
   *   webhook, which Flutterwave will redeliver if we take too long to answer.
   */
  async send(
    to: string,
    mail: Mail,
    from: string,
    replyTo?: string,
    timeoutMs = 15_000,
  ): Promise<ResendSendResult> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
        }),
        signal: abort.signal,
      });

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; message?: string; name?: string }
        | null;

      if (!response.ok) {
        /*
         * Resend reports the two failures worth naming as 403 with a message,
         * and both are configuration rather than transport:
         *
         *   "The zhspress.org domain is not verified."
         *   "You can only send testing emails to your own email address."
         *
         * Passing the message through verbatim matters — it is the difference
         * between "email is broken" and a one-line fix, and neither failure is
         * visible anywhere else until someone reads these logs.
         */
        return {
          ok: false,
          error: payload?.message ?? `HTTP ${response.status}`,
          // 4xx is our mistake and will fail identically on retry. 429 and 5xx
          // are the provider's, and will not.
          retryable: response.status === 429 || response.status >= 500,
        };
      }

      return { ok: true, id: payload?.id };
    } catch (error) {
      const aborted = (error as Error).name === 'AbortError';
      return {
        ok: false,
        error: aborted ? `timed out after ${timeoutMs}ms` : (error as Error).message,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Checks the key without sending.
   *
   * Listing domains is the cheapest authenticated call Resend offers, but the
   * status codes do not mean what you would guess, and this was verified
   * against the live API rather than assumed:
   *
   * - An **invalid key returns 400**, not 401:
   *   `{"message":"API key is invalid"}`.
   * - A **send-only key returns 401**:
   *   `{"message":"This API key is restricted to only send emails"}` — and that
   *   is a perfectly good key. It is the *recommended* kind, since a key that
   *   can only send is the least damaging one to leak.
   *
   * So 400 is fatal and 401 is fine, which is the exact opposite of what the
   * status codes suggest. The message decides; the code is noise. Both strings
   * above were captured from the live API, the second from a real deployment
   * where an earlier version of this method reported a working key as broken.
   */
  async verify(): Promise<{
    ok: boolean;
    error?: string;
    domains?: string[];
    /** Key can send but not read, so the From domain cannot be pre-checked. */
    restricted?: boolean;
  }> {
    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      const payload = (await response.json().catch(() => null)) as {
        data?: Array<{ name?: string; status?: string }>;
        message?: string;
      } | null;

      if (!response.ok) {
        const message = payload?.message ?? `HTTP ${response.status}`;

        // A send-only key. It cannot list domains and does not need to — it can
        // do the one thing this service asks of it.
        if (/restricted/i.test(message)) {
          return { ok: true, restricted: true };
        }

        if (/invalid|not found|unauthor/i.test(message)) {
          return { ok: false, error: `${message} (HTTP ${response.status})` };
        }

        // Anything else is a provider hiccup, and must not stop the API
        // booting. Sending is what really proves the key, and it reports its
        // own failure clearly.
        return { ok: true };
      }

      return {
        ok: true,
        domains: (payload?.data ?? [])
          .filter((domain) => domain.status === 'verified')
          .map((domain) => domain.name ?? '')
          .filter(Boolean),
      };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}

/**
 * Extracts the bare address from a From header.
 *
 * `MAIL_FROM` is written as `ZHS Press <hello@zhspress.org>`, and the domain
 * that must be verified is inside the angle brackets.
 */
export function addressDomain(from: string): string | null {
  const match = /<([^>]+)>/.exec(from) ?? [null, from];
  const address = (match[1] ?? '').trim();
  const at = address.lastIndexOf('@');
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}
