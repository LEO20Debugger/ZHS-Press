import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { createCheckoutSchema, type CreateCheckoutInput } from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CheckoutService } from './checkout.service';

/**
 * Flutterwave's transaction id, lifted off the redirect's query string.
 *
 * Bounded and digits-only because it is a pointer we are about to put into an
 * outbound URL. The value is never trusted as evidence — see
 * `reconcileFromRedirect` — but it should not be arbitrary text either.
 */
const reconcileSchema = z.object({
  transactionId: z.string().regex(/^\d{1,32}$/),
});

@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('checkout')
  create(
    @Headers('x-cart-token') token: string | undefined,
    @Body(new ZodValidationPipe(createCheckoutSchema)) body: CreateCheckoutInput,
  ) {
    if (!token) throw new BadRequestException('Missing cart session');
    return this.checkout.createCheckout(token, body);
  }

  /**
   * The confirmation page polls this while the webhook is in flight. It is
   * addressed by the unguessable order number and returns no internal fields.
   */
  @Get('orders/:orderNumber')
  findOrder(@Param('orderNumber') orderNumber: string) {
    return this.checkout.findOrder(orderNumber);
  }

  /**
   * Fallback settlement, triggered by the customer landing back on the site.
   *
   * POST rather than GET because it can change the order: a GET that settles a
   * payment would be re-run by any prefetch, crawler, or browser history
   * restore. Returns the order either way, so the confirmation page can render
   * from this response without a second round trip.
   */
  @Post('orders/:orderNumber/reconcile')
  @HttpCode(200)
  reconcile(
    @Param('orderNumber') orderNumber: string,
    @Body(new ZodValidationPipe(reconcileSchema)) body: { transactionId: string },
  ) {
    return this.checkout.reconcileFromRedirect(orderNumber, body.transactionId);
  }
}
