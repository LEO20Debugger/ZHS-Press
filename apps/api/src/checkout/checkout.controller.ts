import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { createCheckoutSchema, type CreateCheckoutInput } from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CheckoutService } from './checkout.service';

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
}
