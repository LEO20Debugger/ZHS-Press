import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import {
  calculateOrderTotals,
  paymentMatchesOrder,
  type CheckoutSession,
  type CreateCheckoutInput,
  type Currency,
  type OrderView,
} from '@zhs/shared';
import { DB } from '../db/db.module';
import type { Env } from '../config/env';
import { CartService } from '../cart/cart.service';
import { MailService } from '../mail/mail.service';
import { orderReceipt, url } from '../mail/templates';
import { FlutterwaveService } from '../payments/flutterwave.service';

/** Human-readable, unambiguous: no O/0 or I/1 confusion when read aloud. */
const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderNumber(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (const byte of bytes) {
    out += ORDER_ALPHABET[byte % ORDER_ALPHABET.length];
  }
  return `ZHS-${out}`;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cart: CartService,
    private readonly flutterwave: FlutterwaveService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
  ) {}

  /**
   * Starts a checkout.
   *
   * Note what this method never reads: any price, quantity total or amount from
   * the request body. The cart is loaded server-side by session token, every
   * price is re-read from `products`, and the total is recomputed from scratch.
   * A client that submits its own total is simply ignored.
   */
  async createCheckout(cartToken: string, input: CreateCheckoutInput): Promise<CheckoutSession> {
    const view = await this.cart.view(cartToken);

    if (view.lines.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    // Re-read straight from products; do not trust even our own cart view's
    // prices, which were assembled for display.
    const productIds = view.lines.map((line) => line.productId);
    const products = await this.db.query.products.findMany({
      where: or(...productIds.map((id) => eq(schema.products.id, id))),
      with: { inventory: true },
    });

    const priceable = view.lines.map((line) => {
      const product = products.find((candidate) => candidate.id === line.productId);
      if (!product || product.status !== 'available') {
        throw new BadRequestException(`"${line.title}" is no longer available.`);
      }

      const inventory = product.inventory as typeof schema.inventory.$inferSelect | undefined;
      if (
        inventory?.trackInventory &&
        !inventory.allowBackorder &&
        inventory.quantity < line.quantity
      ) {
        throw new BadRequestException(
          `Only ${inventory.quantity} of "${product.title}" left in stock.`,
        );
      }

      return {
        productId: product.id,
        unitPriceCents: product.priceCents,
        quantity: line.quantity,
        title: product.title,
        slug: product.slug,
      };
    });

    const shippingRate = await this.resolveShippingRate(input.shippingAddress.country);
    const totals = calculateOrderTotals(priceable, { shipping: shippingRate });

    const orderNumber = generateOrderNumber();
    const txRef = FlutterwaveService.generateTxRef(orderNumber);

    const orderId = await this.db.transaction(async (tx) => {
      const [inserted] = await tx.insert(schema.orders).values({
        orderNumber,
        email: input.email,
        status: 'pending',
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        currency: totals.currency,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress ?? input.shippingAddress,
        customerNote: input.customerNote ?? null,
      });

      const newOrderId = Number((inserted as unknown as { insertId: number }).insertId);

      await tx.insert(schema.orderItems).values(
        totals.lines.map((line) => {
          const source = priceable.find((entry) => entry.productId === line.productId);
          return {
            orderId: newOrderId,
            productId: line.productId,
            titleSnapshot: source?.title ?? 'Unknown item',
            slugSnapshot: source?.slug ?? '',
            unitPriceCents: line.unitPriceCents,
            quantity: line.quantity,
            lineTotalCents: line.lineTotalCents,
          };
        }),
      );

      await tx.insert(schema.payments).values({
        orderId: newOrderId,
        provider: 'flutterwave',
        txRef,
        amountCents: totals.totalCents,
        currency: totals.currency,
        status: 'initiated',
      });

      return newOrderId;
    });

    this.logger.log(`Order ${orderNumber} (#${orderId}) created, awaiting payment`);

    const paymentLink = await this.flutterwave.createPaymentLink({
      txRef,
      amountCents: totals.totalCents,
      currency: totals.currency,
      customerEmail: input.email,
      customerName: input.shippingAddress.name,
      title: 'ZHS Press',
      redirectUrl: `${this.config.get('WEB_BASE_URL', { infer: true })}/order/${orderNumber}`,
    });

    return { orderNumber, paymentLink };
  }

  /**
   * Handles a verified Flutterwave transaction.
   *
   * This is the ONLY path that can mark an order paid. The browser redirect back
   * from Flutterwave carries attacker-controlled query parameters and grants
   * nothing.
   *
   * Idempotency is enforced by a conditional UPDATE on the payment row rather
   * than by reading-then-writing: the `status <> 'successful'` predicate makes
   * claiming the payment an atomic operation, so two webhooks delivered
   * concurrently cannot both proceed. Exactly one wins and decrements stock.
   */
  async settlePayment(verified: {
    txRef: string;
    providerTxId: string;
    amountCents: number;
    currency: string;
    successful: boolean;
    raw: unknown;
  }): Promise<{ handled: boolean; reason?: string }> {
    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.txRef, verified.txRef),
    });

    if (!payment) {
      this.logger.warn(`Webhook for unknown tx_ref ${verified.txRef}`);
      return { handled: false, reason: 'unknown_reference' };
    }

    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, payment.orderId),
    });

    if (!order) {
      return { handled: false, reason: 'unknown_order' };
    }

    if (!verified.successful) {
      await this.db
        .update(schema.payments)
        .set({ status: 'failed', providerTxId: verified.providerTxId, rawPayload: verified.raw })
        .where(and(eq(schema.payments.id, payment.id), eq(schema.payments.status, 'initiated')));
      return { handled: true, reason: 'not_successful' };
    }

    // The amount-and-currency assertion. A webhook saying "successful" is not
    // evidence that the right amount, in the right currency, was paid.
    if (!paymentMatchesOrder(order, verified)) {
      this.logger.error(
        `Payment mismatch on ${order.orderNumber}: expected ` +
          `${order.totalCents} ${order.currency}, provider reported ` +
          `${verified.amountCents} ${verified.currency}`,
      );
      await this.db
        .update(schema.payments)
        .set({ status: 'failed', providerTxId: verified.providerTxId, rawPayload: verified.raw })
        .where(eq(schema.payments.id, payment.id));
      return { handled: false, reason: 'amount_mismatch' };
    }

    const outcome = await this.db.transaction(async (tx) => {
      // Atomic claim. If another delivery already settled this payment, this
      // affects zero rows and we stop — no second decrement, no second email.
      const claim = await tx
        .update(schema.payments)
        .set({
          status: 'successful',
          providerTxId: verified.providerTxId,
          rawPayload: verified.raw,
        })
        .where(
          and(eq(schema.payments.id, payment.id), sql`${schema.payments.status} <> 'successful'`),
        );

      const claimed = Number((claim as unknown as { affectedRows?: number }).affectedRows ?? 0);
      if (claimed === 0) {
        return { handled: true, reason: 'already_settled' as const, receipt: false };
      }

      await tx
        .update(schema.orders)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(schema.orders.id, order.id));

      const items = await tx.query.orderItems.findMany({
        where: eq(schema.orderItems.orderId, order.id),
      });

      for (const item of items) {
        if (item.productId == null) continue;

        await tx
          .update(schema.inventory)
          .set({ quantity: sql`GREATEST(${schema.inventory.quantity} - ${item.quantity}, 0)` })
          .where(
            and(
              eq(schema.inventory.productId, item.productId),
              eq(schema.inventory.trackInventory, true),
            ),
          );

        // Flip anything that has just run out, so the storefront stops
        // offering it without waiting for someone to notice.
        await tx
          .update(schema.products)
          .set({ status: 'sold_out' })
          .where(
            and(
              eq(schema.products.id, item.productId),
              sql`EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = ${schema.products.id}
                    AND i.track_inventory = 1 AND i.allow_backorder = 0 AND i.quantity <= 0)`,
            ),
          );
      }

      this.logger.log(`Order ${order.orderNumber} paid and stock adjusted`);
      return { handled: true, receipt: true, items };
    });

    /*
     * The receipt is sent here, outside the transaction, and only by the
     * delivery that won the claim.
     *
     * Outside, because an SMTP round trip inside an open transaction holds
     * database locks for the length of a network call to a third party — and
     * because a send that succeeded followed by a rollback would tell a
     * customer their order was confirmed when it was not. Committing first
     * means the worst case is a real order with no receipt, which is
     * recoverable; the reverse is not.
     *
     * Only the winner, because `already_settled` is the normal case for a
     * redelivered webhook, and Flutterwave redelivers. Sending on every
     * delivery would mail the customer two or three times for one order.
     */
    if (outcome.receipt) {
      await this.sendReceipt(order, outcome.items ?? []);
    }

    const { receipt: _receipt, items: _items, ...result } = outcome;
    return result;
  }

  /**
   * Emails the order receipt.
   *
   * Failure is swallowed after logging, deliberately. The caller is the
   * Flutterwave webhook, and a non-2xx response makes Flutterwave redeliver —
   * which would hit `already_settled`, so the retry could never send the
   * receipt anyway, while making the provider's dashboard show a failing
   * endpoint for a payment that settled perfectly.
   */
  private async sendReceipt(
    order: { orderNumber: string; email: string },
    items: Array<{
      titleSnapshot: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    }>,
  ): Promise<void> {
    try {
      // Re-read rather than reuse the pre-transaction row: `status` and
      // `paidAt` have just changed, and the totals are read back from the
      // committed state that was actually charged.
      const fresh = await this.db.query.orders.findFirst({
        where: eq(schema.orders.orderNumber, order.orderNumber),
      });
      if (!fresh) return;

      await this.mail.send(
        fresh.email,
        orderReceipt({
          order: {
            orderNumber: fresh.orderNumber,
            currency: fresh.currency as Currency,
            subtotalCents: fresh.subtotalCents,
            shippingCents: fresh.shippingCents,
            taxCents: fresh.taxCents,
            totalCents: fresh.totalCents,
            items: items.map((item) => ({
              titleSnapshot: item.titleSnapshot,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              lineTotalCents: item.lineTotalCents,
            })),
            shippingAddress: fresh.shippingAddress ?? null,
          },
          orderUrl: url(
            this.config.get('WEB_BASE_URL', { infer: true }),
            `order/${encodeURIComponent(fresh.orderNumber)}`,
          ),
        }),
        `order receipt ${fresh.orderNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Order ${order.orderNumber} settled but the receipt could not be built: ` +
          (error as Error).message,
        error as Error,
      );
    }
  }

  async findOrder(orderNumber: string): Promise<OrderView> {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, orderNumber),
    });

    if (!order) throw new NotFoundException('Order not found');

    const items = await this.db.query.orderItems.findMany({
      where: eq(schema.orderItems.orderId, order.id),
      orderBy: asc(schema.orderItems.id),
    });

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      currency: order.currency as OrderView['currency'],
      items: items.map((item) => ({
        titleSnapshot: item.titleSnapshot,
        slugSnapshot: item.slugSnapshot,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      })),
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    };
  }

  /** Flat rate per zone — the launch implementation (brief s3, fulfilment TBC). */
  private async resolveShippingRate(
    countryCode: string,
  ): Promise<{ rateCents: number; freeOverCents: number | null }> {
    const rates = await this.db.query.shippingRates.findMany();

    const zone =
      rates.find((rate) => rate.countryCodes.includes(countryCode.toUpperCase())) ??
      rates.find((rate) => rate.isDefault);

    // No rates configured yet: charge nothing rather than inventing a number.
    // Checkout still works end to end, which is what the placeholder is for.
    if (!zone) return { rateCents: 0, freeOverCents: null };

    return { rateCents: zone.rateCents, freeOverCents: zone.freeOverCents };
  }
}
