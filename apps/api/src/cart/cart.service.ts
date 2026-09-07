import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { AddToCartInput, CartLine, CartView, UpdateCartItemInput } from '@zhs/shared';
import { DEFAULT_CURRENCY } from '@zhs/shared';
import { DB } from '../db/db.module';

/** Carts are disposable; a month is long enough for anyone's second thoughts. */
const CART_TTL_DAYS = 30;

@Injectable()
export class CartService {
  constructor(@Inject(DB) private readonly db: Database) {}

  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private expiry(): Date {
    return new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private async findCart(token: string) {
    return this.db.query.carts.findFirst({ where: eq(schema.carts.sessionToken, token) });
  }

  private async requireCart(token: string) {
    const cart = await this.findCart(token);
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  async ensureCart(token: string): Promise<void> {
    const existing = await this.findCart(token);
    if (existing) {
      await this.db
        .update(schema.carts)
        .set({ expiresAt: this.expiry() })
        .where(eq(schema.carts.id, existing.id));
      return;
    }

    await this.db
      .insert(schema.carts)
      .values({ sessionToken: token, expiresAt: this.expiry() });
  }

  /**
   * Builds the cart view.
   *
   * Prices are re-read from `products` on every read, not taken from the stored
   * `cart_items.unit_price_cents`. That column is a record of what the price was
   * when the item was added; it is never what the customer is charged. If a
   * price changed while the cart sat open, the customer sees the current price
   * before they reach checkout rather than being surprised at the payment step.
   */
  async view(token: string): Promise<CartView> {
    const cart = await this.findCart(token);
    if (!cart) {
      return { lines: [], subtotalCents: 0, currency: DEFAULT_CURRENCY, itemCount: 0 };
    }

    const rows = await this.db.query.cartItems.findMany({
      where: eq(schema.cartItems.cartId, cart.id),
      orderBy: asc(schema.cartItems.createdAt),
      with: {
        product: {
          with: { images: { orderBy: asc(schema.productImages.position), limit: 1 } },
        },
      },
    });

    const lines: CartLine[] = [];
    for (const row of rows) {
      const product = row.product as typeof schema.products.$inferSelect & {
        images?: Array<typeof schema.productImages.$inferSelect>;
      };

      // A product that went out of stock or was unpublished while the cart sat
      // open silently drops out of the view rather than blocking checkout.
      if (!product || product.status !== 'available') continue;

      const cover = product.images?.[0];
      lines.push({
        productId: product.id,
        slug: product.slug,
        title: product.title,
        type: product.type,
        unitPriceCents: product.priceCents,
        quantity: row.quantity,
        lineTotalCents: product.priceCents * row.quantity,
        coverImage: cover
          ? { url: cover.url, alt: cover.alt, width: cover.width, height: cover.height }
          : null,
      });
    }

    return {
      lines,
      subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
      currency: DEFAULT_CURRENCY,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  }

  async addItem(token: string, input: AddToCartInput): Promise<CartView> {
    await this.ensureCart(token);
    const cart = await this.requireCart(token);

    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, input.productId),
      with: { inventory: true },
    });

    if (!product || product.status !== 'available') {
      throw new BadRequestException('That item is not available to buy.');
    }

    const inventory = product.inventory as typeof schema.inventory.$inferSelect | undefined;
    if (inventory?.trackInventory && !inventory.allowBackorder) {
      if (inventory.quantity < input.quantity) {
        throw new BadRequestException(
          inventory.quantity === 0
            ? 'That item just sold out.'
            : `Only ${inventory.quantity} left in stock.`,
        );
      }
    }

    // The unique (cart_id, product_id) index makes this an upsert rather than a
    // duplicate line, so adding the same book twice increments it.
    await this.db
      .insert(schema.cartItems)
      .values({
        cartId: cart.id,
        productId: product.id,
        quantity: input.quantity,
        unitPriceCents: product.priceCents,
      })
      .onDuplicateKeyUpdate({
        set: { quantity: sql`${schema.cartItems.quantity} + ${input.quantity}` },
      });

    return this.view(token);
  }

  async updateItem(token: string, input: UpdateCartItemInput): Promise<CartView> {
    const cart = await this.requireCart(token);

    if (input.quantity === 0) {
      await this.db
        .delete(schema.cartItems)
        .where(
          and(
            eq(schema.cartItems.cartId, cart.id),
            eq(schema.cartItems.productId, input.productId),
          ),
        );
      return this.view(token);
    }

    await this.db
      .update(schema.cartItems)
      .set({ quantity: input.quantity })
      .where(
        and(eq(schema.cartItems.cartId, cart.id), eq(schema.cartItems.productId, input.productId)),
      );

    return this.view(token);
  }

  /** Called after an order is paid. */
  async clear(token: string): Promise<void> {
    const cart = await this.findCart(token);
    if (!cart) return;
    await this.db.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cart.id));
  }

  /** Housekeeping for a scheduled job; abandoned carts should not accumulate. */
  async purgeExpired(): Promise<number> {
    const result = await this.db
      .delete(schema.carts)
      .where(lt(schema.carts.expiresAt, new Date()));
    return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
  }
}
