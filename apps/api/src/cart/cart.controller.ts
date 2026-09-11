import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Put,
  BadRequestException,
} from '@nestjs/common';
import {
  addToCartSchema,
  updateCartItemSchema,
  type AddToCartInput,
  type UpdateCartItemInput,
} from '@zhs/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CartService } from './cart.service';

/**
 * The cart is addressed by an opaque token which the web app holds in an
 * httpOnly cookie and forwards here. It is never in the URL and never readable
 * by client-side JavaScript.
 */
const TOKEN_HEADER = 'x-cart-token';

function requireToken(token: string | undefined): string {
  if (!token || token.length < 32) {
    throw new BadRequestException('Missing cart session');
  }
  return token;
}

@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  view(@Headers(TOKEN_HEADER) token: string | undefined) {
    return this.cart.view(requireToken(token));
  }

  @Post('items')
  addItem(
    @Headers(TOKEN_HEADER) token: string | undefined,
    @Body(new ZodValidationPipe(addToCartSchema)) body: AddToCartInput,
  ) {
    return this.cart.addItem(requireToken(token), body);
  }

  @Put('items')
  updateItem(
    @Headers(TOKEN_HEADER) token: string | undefined,
    @Body(new ZodValidationPipe(updateCartItemSchema)) body: UpdateCartItemInput,
  ) {
    return this.cart.updateItem(requireToken(token), body);
  }

  /** Empties the cart, keeping the session. Returns the emptied cart. */
  @Delete()
  clear(@Headers(TOKEN_HEADER) token: string | undefined) {
    return this.cart.clearAndView(requireToken(token));
  }
}
