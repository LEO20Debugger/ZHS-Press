import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { requirePaymentConfig, type Env } from '../config/env';

/**
 * Stripe Checkout integration.
 *
 * Two things about this deployment drive the design here:
 *
 * 1. The Stripe account is SHARED with another business. Every session this
 *    shop creates is tagged `metadata.source = zhs-press`, and anything without
 *    that tag — the other business's checkouts arriving on the same webhook —
 *    is ignored before it reaches the database. The tag also lets the account
 *    owner filter shop sales out of Stripe's own reports.
 *
 * 2. The webhook signature is a real HMAC over the raw body, so a verified
 *    event is genuine. Settlement still re-reads the session from Stripe rather
 *    than acting on the event payload: events can arrive out of order, and the
 *    session as it stands NOW is what decides the order, not the session as it
 *    stood when some earlier event was queued.
 */

/** Marks sessions as this shop's on an account shared with another business. */
export const PAYMENT_SOURCE = 'zhs-press';

/**
 * Appended to the account's statement descriptor on card payments, so the
 * charge is recognisable as ZHS Press on a statement that otherwise carries the
 * shared account's name. Unrecognised charges become disputes.
 */
const STATEMENT_SUFFIX = 'ZHS PRESS';

export interface CheckoutLine {
  title: string;
  unitPriceCents: number;
  quantity: number;
}

export interface CreateCheckoutSessionInput {
  txRef: string;
  orderNumber: string;
  currency: string;
  customerEmail: string;
  lines: CheckoutLine[];
  shippingCents: number;
  taxCents: number;
  successUrl: string;
  cancelUrl: string;
}

export interface VerifiedTransaction {
  providerTxId: string;
  txRef: string;
  amountCents: number;
  currency: string;
  successful: boolean;
  raw: unknown;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get env(): Env {
    return {
      STRIPE_SECRET_KEY: this.config.get('STRIPE_SECRET_KEY', { infer: true }),
      STRIPE_WEBHOOK_SECRET: this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true }),
    } as Env;
  }

  /** Built on first use, so the API boots without payment configuration. */
  private stripe(): Stripe {
    if (!this.client) {
      const { secretKey } = requirePaymentConfig(this.env);
      this.client = new Stripe(secretKey);
    }
    return this.client;
  }

  /** A collision-resistant reference we generate and Stripe echoes back. */
  static generateTxRef(orderNumber: string): string {
    return `${orderNumber}-${randomBytes(8).toString('hex')}`;
  }

  /**
   * Checks the Stripe-Signature header against the exact bytes received.
   *
   * Returns null rather than throwing on a bad signature: the caller turns that
   * into a 400, and nothing about a forged request is worth a stack trace.
   */
  constructEvent(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event | null {
    const { webhookSecret } = requirePaymentConfig(this.env);

    if (!rawBody || !signature) return null;

    try {
      return this.stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      return null;
    }
  }

  /**
   * Opens a hosted Checkout page for an order.
   *
   * One Stripe line per order line, plus shipping and tax, all in integer
   * cents — Stripe's unit is the same as ours, so there is no conversion to get
   * wrong. Their sum is the order total by construction; settlement asserts it
   * anyway, against what Stripe reports was actually charged.
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<{ url: string; sessionId: string }> {
    const currency = input.currency.toLowerCase();
    const metadata = {
      source: PAYMENT_SOURCE,
      order_number: input.orderNumber,
      tx_ref: input.txRef,
    };

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency,
        unit_amount: line.unitPriceCents,
        product_data: { name: line.title },
      },
    }));

    for (const [name, cents] of [
      ['Shipping', input.shippingCents],
      ['Tax', input.taxCents],
    ] as const) {
      if (cents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: { currency, unit_amount: cents, product_data: { name } },
        });
      }
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe().checkout.sessions.create(
        {
          mode: 'payment',
          line_items: lineItems,
          customer_email: input.customerEmail,
          client_reference_id: input.txRef,
          metadata,
          payment_intent_data: {
            metadata,
            statement_descriptor_suffix: STATEMENT_SUFFIX,
          },
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
        },
        // A retried checkout for the same reference must not open a second
        // session that could be paid alongside the first.
        { idempotencyKey: `checkout-${input.txRef}` },
      );
    } catch (error) {
      this.logger.error(
        `Stripe rejected checkout for ${input.txRef}: ${(error as Error).message}`,
      );
      throw new Error('Could not start payment. Please try again.');
    }

    if (!session.url) {
      this.logger.error(`Stripe returned no checkout URL for ${input.txRef}`);
      throw new Error('Could not start payment. Please try again.');
    }

    return { url: session.url, sessionId: session.id };
  }

  /**
   * Asks Stripe what has actually happened to a Checkout Session.
   *
   * Returns null when the session is still undecided — open, or completed with
   * a payment method that settles later (a bank debit, say). That is not a
   * failure, and recording it as one would be wrong; the async_payment events
   * will bring the answer.
   *
   * Returns null too for a session this shop did not create. On a shared
   * account that is the other business's checkout, and none of ours.
   */
  async verifySession(sessionId: string): Promise<VerifiedTransaction | null> {
    let session: Stripe.Checkout.Session;
    try {
      // Expanded so a delayed payment that later failed can be told apart from
      // one still in flight: the session alone reads "unpaid" for both.
      session = await this.stripe().checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });
    } catch (error) {
      // Carry Stripe's own message: a wrong key, a live/test mix-up and a
      // session that does not exist all read differently there, and identically
      // without it.
      throw new Error(`Could not verify session ${sessionId}: ${(error as Error).message}`);
    }

    return toVerifiedTransaction(session);
  }
}

/**
 * Maps a Checkout Session to the provider-neutral shape settlement takes.
 *
 * Exported for tests: the decision of what counts as paid, failed or not yet
 * known lives here, and it is the part worth pinning down.
 */
export function toVerifiedTransaction(session: Stripe.Checkout.Session): VerifiedTransaction | null {
  if (session.metadata?.source !== PAYMENT_SOURCE) return null;

  const txRef = session.client_reference_id ?? session.metadata?.tx_ref;
  if (!txRef) return null;

  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;

  let successful: boolean;
  if (session.status === 'complete' && session.payment_status === 'paid') {
    successful = true;
  } else if (session.status === 'expired') {
    successful = false;
  } else if (
    session.status === 'complete' &&
    (intent?.status === 'requires_payment_method' || intent?.status === 'canceled')
  ) {
    // A delayed payment method (a bank debit) that was later declined.
    successful = false;
  } else {
    return null;
  }

  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : intent?.id;

  return {
    // The PaymentIntent id is what Stripe's dashboard and support search by.
    // An expired session never created one, so fall back to the session id.
    providerTxId: paymentIntent ?? session.id,
    txRef,
    amountCents: session.amount_total ?? 0,
    // Stripe reports lower case; orders store the ISO code in upper case.
    currency: (session.currency ?? '').toUpperCase(),
    successful,
    raw: session,
  };
}
