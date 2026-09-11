import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { ResendTransport, addressDomain } from './resend-transport';
import type { Env } from '../config/env';
import type { Mail } from './templates';

export interface SmtpConnection {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

/**
 * Parses an SMTP URL into connection options.
 *
 * nodemailer does accept a URL string, but only as the *whole* transport — it
 * cannot be combined with the pool and timeout options this service needs, so
 * the URL is taken apart here instead.
 *
 * Two details are easy to get wrong and both produce a hang rather than an
 * error:
 *
 * - **`secure` means implicit TLS**, which is port 465 only. Port 587 must be
 *   `secure: false` and upgrade via STARTTLS. Setting `secure: true` on 587
 *   makes the client wait for a TLS handshake on a plaintext socket.
 * - **Credentials are percent-encoded in a URL.** Provider passwords routinely
 *   contain `@`, `/` and `+`, so they must be decoded or authentication fails
 *   with a password that looks correct in the dashboard.
 */
export function parseSmtpUrl(raw: string): SmtpConnection {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `SMTP_URL is not a valid URL. Expected smtps://user:pass@host:465, got "${raw}".`,
    );
  }

  const secure = parsed.protocol === 'smtps:';
  const port = parsed.port ? Number(parsed.port) : secure ? 465 : 587;

  return {
    host: parsed.hostname,
    port,
    secure,
    ...(parsed.username
      ? {
          auth: {
            user: decodeURIComponent(parsed.username),
            pass: decodeURIComponent(parsed.password),
          },
        }
      : {}),
  };
}

export interface SendResult {
  sent: boolean;
  /** Why not, when `sent` is false. Returned rather than thrown — see `send`. */
  reason?: 'not_configured' | 'transport_error' | 'rejected';
}

/**
 * Outbound email.
 *
 * Two decisions in here matter more than the code:
 *
 * **Sending never throws.** `send` catches everything and returns a result.
 * Email is a side effect of the thing the user actually asked for, and a
 * relay timing out must not turn a completed order into a 500 — the customer
 * has already paid, the stock is already decremented, and failing the webhook
 * would make Flutterwave redeliver it. Callers log and carry on. The cost of
 * this choice is that a broken relay is invisible unless someone reads the
 * logs, which is why every failure is logged at `error` with the template name
 * and recipient.
 *
 * **An unconfigured transport logs instead of failing.** Without SMTP_URL the
 * message is written to the log, subject and all, including any link it
 * carried. That keeps newsletter double opt-in and submissions genuinely
 * testable locally — you copy the confirm URL out of the terminal — and it is
 * exactly what this codebase did before a transport existed. In production the
 * same state is a real fault, so it is reported loudly at boot instead of once
 * per message.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private resend: ResendTransport | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get configured(): boolean {
    return Boolean(
      this.config.get('RESEND_API_KEY', { infer: true }) ??
        this.config.get('SMTP_URL', { infer: true }),
    );
  }

  /**
   * The HTTPS transport, when a Resend key is set. Preferred over SMTP.
   *
   * Railway blocks outbound SMTP on every plan below Pro — 25, 465, 587 and
   * 2525 — so on the host this API actually runs on, SMTP cannot work at all.
   * It times out rather than refusing, which is why the symptom is a ten-second
   * stall and a "Connection timeout" that looks like a bad hostname.
   */
  private httpTransport(): ResendTransport | null {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    if (!apiKey) return null;
    if (!this.resend) this.resend = new ResendTransport(apiKey);
    return this.resend;
  }

  /**
   * Built once, lazily, and reused.
   *
   * nodemailer keeps a connection pool on the transporter, so constructing one
   * per message means a fresh TLS handshake per message — slow, and enough to
   * hit the connection-rate limits that providers apply.
   */
  private transport(): Transporter | null {
    const smtpUrl = this.config.get('SMTP_URL', { infer: true });
    if (!smtpUrl) return null;

    if (!this.transporter) {
      this.transporter = createTransport({
        ...parseSmtpUrl(smtpUrl),
        pool: true,
        maxConnections: 2,
        // A hung relay must not hold a request open indefinitely.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
    }

    return this.transporter;
  }

  /**
   * Checked at boot, so a wrong password is found on deploy rather than by a
   * customer who never receives a receipt.
   *
   * `verify()` completes the SMTP handshake and authenticates without sending,
   * which catches the overwhelming majority of misconfigurations: bad host,
   * wrong port, rejected credentials, TLS mismatch. It cannot catch an
   * unverified From domain — that failure happens at send time, or silently at
   * the provider.
   */
  async verifyTransport(): Promise<void> {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';

    const http = this.httpTransport();
    if (http) {
      const result = await http.verify();

      if (!result.ok) {
        this.logger.error(`Resend API key failed to verify: ${result.error}`);
        return;
      }

      this.logger.log(
        `Mail transport ready (Resend API), sending as ${this.from}` +
          (result.restricted ? ' [send-only key]' : ''),
      );

      /*
       * A send-only key cannot list domains, so the From domain cannot be
       * checked here. Say so rather than staying quiet: silence would read as
       * "the domain is fine", and the 403 that follows on every send is the
       * single most likely thing to go wrong with this configuration.
       */
      if (result.restricted) {
        const domain = addressDomain(this.from);
        if (domain && domain !== 'resend.dev') {
          this.logger.warn(
            `Cannot confirm "${domain}" is verified at Resend — this key can send ` +
              'but not read. If sends fail with "domain is not verified", either ' +
              'verify it at resend.com/domains or use onboarding@resend.dev.',
          );
        }
      }

      /*
       * Warn when the From domain is not among the verified ones.
       *
       * This is the failure the old SMTP `verify()` could never catch: the
       * credentials are perfect, boot looks clean, and then every single send
       * is refused with "The <domain> domain is not verified" — discovered by a
       * customer who paid and got no receipt. Checking it at boot turns that
       * into one line in the deploy log.
       */
      const domain = addressDomain(this.from);
      if (domain && result.domains && !result.domains.includes(domain)) {
        this.logger.error(
          `MAIL_FROM uses "${domain}", which is NOT verified at Resend` +
            (result.domains.length
              ? ` (verified: ${result.domains.join(', ')}).`
              : ' (no verified domains on this account).') +
            ' Every send will be refused with a 403. Either verify the domain at' +
            ' resend.com/domains, or set MAIL_FROM to "ZHS Press <onboarding@resend.dev>"' +
            ' — which can only deliver to the account holder\'s own address.',
        );
      }
      return;
    }

    const transport = this.transport();
    if (!transport) {
      const message =
        'Neither RESEND_API_KEY nor SMTP_URL is set. Newsletter confirmations, ' +
        'order receipts and submission alerts will be logged instead of sent.';

      // In production this is not a notice, it is a defect: customers who pay
      // get no receipt and nobody can complete a newsletter opt-in.
      if (isProduction) this.logger.error(message);
      else this.logger.warn(message);
      return;
    }

    try {
      await transport.verify();
      this.logger.log(`Mail transport ready (SMTP), sending as ${this.from}`);
    } catch (error) {
      this.logger.error(
        `Mail transport failed to verify: ${(error as Error).message}. ` +
          'Check SMTP_URL host, port and credentials. Note that Railway blocks ' +
          'outbound SMTP below the Pro plan — set RESEND_API_KEY to send over ' +
          'HTTPS instead.',
      );
    }
  }

  private get from(): string {
    return this.config.get('MAIL_FROM', { infer: true });
  }

  /** Internal recipient for submission alerts. Falls back to the From address. */
  get pressAddress(): string {
    return this.config.get('PRESS_NOTIFY_EMAIL', { infer: true }) ?? this.from;
  }

  /**
   * @param label Identifies the template in logs. Recipients are logged with
   *   it; message bodies are not, since they carry confirmation and
   *   unsubscribe tokens that act as bearer credentials — except when there is
   *   no transport at all, where the log *is* the delivery mechanism.
   */
  async send(to: string, mail: Mail, label: string): Promise<SendResult> {
    const replyToAddress = this.config.get('MAIL_REPLY_TO', { infer: true });

    // HTTPS first — it is the only transport that works on Railway.
    const http = this.httpTransport();
    if (http) {
      const result = await http.send(to, mail, this.from, replyToAddress);

      if (result.ok) {
        this.logger.log(`Sent ${label} to ${to} (${result.id})`);
        return { sent: true };
      }

      this.logger.error(`Failed to send ${label} to ${to}: ${result.error}`);
      return { sent: false, reason: result.retryable ? 'transport_error' : 'rejected' };
    }

    const transport = this.transport();

    if (!transport) {
      this.logger.warn(
        `[not sent: no mail transport] ${label} -> ${to}\n` +
          `  subject: ${mail.subject}\n` +
          mail.text
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n'),
      );
      return { sent: false, reason: 'not_configured' };
    }

    try {
      const info = await transport.sendMail({
        from: this.from,
        to,
        ...(replyToAddress ? { replyTo: replyToAddress } : {}),
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });

      this.logger.log(`Sent ${label} to ${to} (${info.messageId})`);
      return { sent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send ${label} to ${to}: ${(error as Error).message}`,
        error as Error,
      );
      return { sent: false, reason: 'transport_error' };
    }
  }

  /** Closes the connection pool so the process can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    this.transporter?.close();
    this.transporter = null;
  }
}
