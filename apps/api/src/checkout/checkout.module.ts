import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { StripeService } from '../payments/stripe.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [CartModule],
  controllers: [CheckoutController, WebhookController],
  providers: [CheckoutService, StripeService],
})
export class CheckoutModule {}
