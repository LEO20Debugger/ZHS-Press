import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { PAYMENT_SOURCE, StripeService } from '../payments/stripe.service';
import { CheckoutService } from './checkout.service';

/** The Checkout events that can move an order. Everything else is ignored. */
const SETTLING_EVENTS = new Set<string>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

/**
 * Picks out the session id of an event this shop should act on.
 *
 * The Stripe account is shared with another business, so the endpoint can
 * receive that business's checkouts too. They are filtered out here, by the
 * metadata every one of our sessions carries, before anything is fetched or
 * written — otherwise each of their sales would log a warning about an unknown
 * reference and cost a round trip to Stripe.
 */
export function sessionIdToSettle(event: Pick<Stripe.Event, 'type' | 'data'>): string | null {
  if (!SETTLING_EVENTS.has(event.type)) return null;

  const session = event.data.object as Partial<Stripe.Checkout.Session>;
  if (session.object !== 'checkout.session' || !session.id) return null;
  if (session.metadata?.source !== PAYMENT_SOURCE) return null;

  return session.id;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly checkout: CheckoutService,
  ) {}

  /**
   * The primary path that marks an order paid.
   *
   * Sequence, and the order matters:
   *
   *   1. Verify the Stripe-Signature HMAC over the raw body. Reject anything
   *      unsigned before doing any work or touching the database.
   *   2. Drop events that are not ours (see sessionIdToSettle).
   *   3. Re-read the session from Stripe, so the decision rests on its state now
   *      rather than on an event that may have been overtaken.
   *   4. Hand the result to settlePayment, which asserts the amount and currency
   *      match the order and claims the order idempotently.
   *
   * Always returns 200 once authenticated, including on mismatch. Stripe
   * retries non-2xx responses for days, and retrying will not fix a payment
   * that does not match its order. The mismatch is logged at error level for a
   * human instead.
   */
  @Post('stripe')
  @HttpCode(200)
  async handleStripe(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; handled: boolean }> {
    const event = this.stripe.constructEvent(request.rawBody, signature);
    if (!event) {
      this.logger.warn('Rejected webhook with missing or invalid Stripe-Signature');
      throw new BadRequestException('Invalid signature');
    }

    const sessionId = sessionIdToSettle(event);
    if (sessionId === null) return { received: true, handled: false };

    const verified = await this.stripe.verifySession(sessionId);
    if (verified === null) {
      // Open, or paid by a method that settles later. A later event decides it.
      return { received: true, handled: false };
    }

    const result = await this.checkout.settlePayment(verified);
    return { received: true, handled: result.handled };
  }
}
