import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { FlutterwaveService } from '../payments/flutterwave.service';
import { CheckoutService } from './checkout.service';

interface FlutterwaveWebhookBody {
  event?: string;
  data?: { id?: number | string; tx_ref?: string; status?: string };
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

    const providerTxId = body.data?.id;
    if (providerTxId == null) {
      this.logger.warn('Authenticated webhook carried no transaction id');
      return { received: true, handled: false };
    }

    const verified = await this.flutterwave.verifyTransaction(String(providerTxId));
    const result = await this.checkout.settlePayment(verified);

    return { received: true, handled: result.handled };
  }
}
