import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requirePaymentConfig, type Env } from '../config/env';

/**
 * Flutterwave integration.
 *
 * Two things about this provider drive the whole design here:
 *
 * 1. The `verif-hash` header is NOT an HMAC over the request body. It is a
 *    static secret string configured in the Flutterwave dashboard and echoed
 *    back verbatim on every webhook. It therefore proves only that the sender
 *    knows a shared secret — it says nothing about the payload, and it does not
 *    change per request. Anyone who ever obtains it can replay or forge
 *    notifications indefinitely.
 *
 * 2. Because of (1), the header alone is not sufficient evidence of payment.
 *    Every webhook is independently re-verified by calling Flutterwave back and
 *    asking what actually happened to that transaction. That call, not the
 *    webhook body, is what we trust.
 *
 * Getting this wrong is the classic way a Flutterwave integration ships orders
 * that were never paid for.
 */

export interface CreatePaymentLinkInput {
  txRef: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  redirectUrl: string;
  title: string;
}

export interface VerifiedTransaction {
  providerTxId: string;
  txRef: string;
  amountCents: number;
  currency: string;
  successful: boolean;
  raw: unknown;
}

interface FlutterwaveVerifyResponse {
  status: string;
  data?: {
    id: number | string;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get env(): Env {
    return {
      NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
      API_PORT: this.config.get('API_PORT', { infer: true }),
      CORS_ORIGINS: this.config.get('CORS_ORIGINS', { infer: true }),
      DATABASE_URL: this.config.get('DATABASE_URL', { infer: true }),
      WEB_BASE_URL: this.config.get('WEB_BASE_URL', { infer: true }),
      FLW_PUBLIC_KEY: this.config.get('FLW_PUBLIC_KEY', { infer: true }),
      FLW_SECRET_KEY: this.config.get('FLW_SECRET_KEY', { infer: true }),
      FLW_SECRET_HASH: this.config.get('FLW_SECRET_HASH', { infer: true }),
      FLW_BASE_URL: this.config.get('FLW_BASE_URL', { infer: true }),
    } as Env;
  }

  /** A collision-resistant reference we generate and the provider echoes back. */
  static generateTxRef(orderNumber: string): string {
    return `${orderNumber}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Constant-time comparison of the webhook's verif-hash header.
   *
   * `timingSafeEqual` throws on length mismatch and would itself leak length
   * through the exception path, so lengths are compared first and the buffers
   * are only handed over when they match.
   */
  verifyWebhookSignature(headerValue: string | undefined): boolean {
    const { secretHash } = requirePaymentConfig(this.env);

    if (!headerValue) return false;

    const provided = Buffer.from(headerValue, 'utf8');
    const expected = Buffer.from(secretHash, 'utf8');

    if (provided.length !== expected.length) return false;

    return timingSafeEqual(provided, expected);
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<string> {
    const { secretKey, baseUrl } = requirePaymentConfig(this.env);

    const response = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.txRef,
        // Flutterwave takes major units. Our domain is integer cents, so the
        // conversion happens here, at the boundary, and nowhere else.
        amount: (input.amountCents / 100).toFixed(2),
        currency: input.currency,
        redirect_url: input.redirectUrl,
        customer: { email: input.customerEmail, name: input.customerName },
        customizations: { title: input.title },
      }),
    });

    const body = (await response.json()) as { status?: string; data?: { link?: string } };

    if (!response.ok || body.status !== 'success' || !body.data?.link) {
      this.logger.error(`Flutterwave rejected payment creation for ${input.txRef}`);
      throw new Error('Could not start payment. Please try again.');
    }

    return body.data.link;
  }

  /**
   * Asks Flutterwave what actually happened to a transaction.
   *
   * This is the authoritative check. The webhook body is treated purely as a
   * notification that *something* happened to this id, never as a statement of
   * what happened.
   */
  async verifyTransaction(providerTxId: string): Promise<VerifiedTransaction> {
    const { secretKey, baseUrl } = requirePaymentConfig(this.env);

    const response = await fetch(
      `${baseUrl}/transactions/${encodeURIComponent(providerTxId)}/verify`,
      { headers: { authorization: `Bearer ${secretKey}` } },
    );

    const body = (await response.json()) as FlutterwaveVerifyResponse;

    if (!response.ok || body.status !== 'success' || !body.data) {
      throw new Error(`Could not verify transaction ${providerTxId}`);
    }

    return {
      providerTxId: String(body.data.id),
      txRef: body.data.tx_ref,
      // Back to integer cents immediately. Math.round, not truncation: the
      // provider returns a float and 14.99 * 100 is 1498.9999999999998.
      amountCents: Math.round(body.data.amount * 100),
      currency: body.data.currency,
      successful: body.data.status === 'successful',
      raw: body,
    };
  }
}
