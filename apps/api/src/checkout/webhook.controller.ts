import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { FlutterwaveService } from '../payments/flutterwave.service';
import { CheckoutService } from './checkout.service';

interface FlutterwaveWebhookBody {
  event?: string;
  id?: number | string;
  transaction_id?: number | string;
  data?: {
    id?: number | string;
    transaction_id?: number | string;
    tx_ref?: string;
    status?: string;
  };
}

/**
 * Pulls the transaction id out of whichever payload shape arrived.
 *
 * Flutterwave does not send one shape. The v3 webhook nests the transaction
 * under `data`; the older format puts `id` at the top level, and which one a
 * merchant receives depends on a dashboard toggle ("Enable v3 webhooks") that
 * can be changed without anyone touching this code. Reading only `data.id`
 * meant an account with that toggle off got a 200 and silent no-op on every
 * notification — a paid order that never settles, with nothing in the
 * provider's delivery log to suggest a problem.
 *
 * Accepting both shapes costs nothing: the id is only ever a pointer. Whatever
 * comes out of here is handed straight to Flutterwave to be verified, and it is
 * their answer — not this payload — that settles anything.
 */
export function extractTransactionId(body: FlutterwaveWebhookBody): string | null {
  const candidates = [
    body.data?.id,
    body.data?.transaction_id,
    body.id,
    body.transaction_id,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const value = String(candidate).trim();
    // Flutterwave transaction ids are numeric. Anything else is a different
    // field that happens to be called "id" — an event id, say — and sending it
    // to the verify endpoint would just produce a confusing failure.
    if (/^\d+$/.test(value)) return value;
  }

  return null;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly flutterwave: FlutterwaveService,
    private readonly checkout: CheckoutService,
  ) {}

  /**
   * The only path that can mark an order paid.
   *
   * Sequence, and the order matters:
   *
   *   1. Constant-time compare the verif-hash header. Reject unauthenticated
   *      callers before doing any work or touching the database.
   *   2. Take ONLY the transaction id from the body. Nothing else in the payload
   *      is trusted — not the amount, not the status, not the reference.
   *   3. Call Flutterwave back and ask what really happened to that id.
   *   4. Hand the verified result to settlePayment, which asserts the amount and
   *      currency match the order and claims the payment idempotently.
   *
   * Always returns 200 once authenticated, including on mismatch. Flutterwave
   * retries non-2xx responses, and retrying will not fix a payment that does not
   * match its order — it would just redeliver forever. The mismatch is logged at
   * error level for a human instead.
   */
  @Post('flutterwave')
  @HttpCode(200)
  async handleFlutterwave(
    @Headers('verif-hash') signature: string | undefined,
    @Body() body: FlutterwaveWebhookBody,
  ): Promise<{ received: true; handled: boolean }> {
    if (!this.flutterwave.verifyWebhookSignature(signature)) {
      this.logger.warn('Rejected webhook with missing or invalid verif-hash');
      throw new UnauthorizedException();
    }

    const providerTxId = extractTransactionId(body);
    if (providerTxId === null) {
      /*
       * Log the shape, not the payload: it can carry a customer's name, email
       * and card metadata, none of which belongs in a log line. The key names
       * alone are enough to tell which format arrived, which is the one thing
       * this message previously left you guessing about.
       */
      this.logger.warn(
        'Authenticated webhook carried no transaction id. Top-level keys: ' +
          `[${Object.keys(body ?? {}).join(', ')}]` +
          (body?.data ? `, data keys: [${Object.keys(body.data).join(', ')}]` : ''),
      );
      return { received: true, handled: false };
    }

    const verified = await this.flutterwave.verifyTransaction(providerTxId);
    const result = await this.checkout.settlePayment(verified);

    return { received: true, handled: result.handled };
  }
}
