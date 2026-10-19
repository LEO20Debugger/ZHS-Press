import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { schema, type Database } from '@zhs/db';
import type { AdminPrincipal } from '../auth/auth.service';
import { DB } from '../db/db.module';
import { AuditService } from './audit.service';

/** Statuses of an order no money was ever taken for. */
const UNPAID = new Set(['pending', 'failed', 'cancelled']);

/**
 * Whether a payment was made in a sandbox rather than with real money.
 *
 * Two ways to know:
 *
 *  - Stripe: the session Stripe returned, which settlement stores on the
 *    payment row, says `livemode: false`. Only that explicit value counts; a
 *    payload without the field is treated as real money, because guessing
 *    wrong in that direction deletes a genuine sale.
 *
 *  - Flutterwave: the shop ran on Flutterwave only before launch, and only
 *    ever with test keys — confirmed by the press — and has since moved to
 *    Stripe. Its payloads carry no live/test marker, so the provider itself
 *    is the evidence. If Flutterwave ever takes real money again, this rule
 *    must go first.
 */
export function isTestPayment(payment: { provider?: string; rawPayload: unknown }): boolean {
  if (payment.provider === 'flutterwave') return true;
  const raw = payment.rawPayload;
  return typeof raw === 'object' && raw !== null && (raw as { livemode?: unknown }).livemode === false;
}

/**
 * Why an order may not be deleted, or null if it may.
 *
 * A real paid order is a financial record: the money sits in Stripe whatever
 * happens here, and deleting the order loses who bought what and where it
 * ships — what a refund, a dispute or the year's accounts all need. So only
 * two kinds go: orders nobody paid for, and orders paid in the sandbox.
 */
export function deletionBlockedReason(
  order: { status: string },
  payments: Array<{ status: string; provider?: string; rawPayload: unknown }>,
): string | null {
  if (UNPAID.has(order.status)) return null;

  const paid = payments.filter((payment) => payment.status === 'successful');
  if (paid.length > 0 && paid.every(isTestPayment)) return null;

  return (
    'This is a real paid order, so it is kept as a financial record. ' +
    'To give the money back, refund it in Stripe.'
  );
}

@Injectable()
export class OrderDeletionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async remove(orderNumber: string, actor: AdminPrincipal): Promise<{ ok: true }> {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, orderNumber),
      with: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const blocked = deletionBlockedReason(order, order.payments);
    if (blocked) throw new ConflictException(blocked);

    // A test order that settled took real stock off the shelf. Give it back, so
    // clearing the sandbox orders before launch does not leave the counts low.
    const tookStock = order.status === 'paid' || order.status === 'fulfilled';

    await this.db.transaction(async (tx) => {
      if (tookStock) {
        for (const item of order.items) {
          if (item.productId == null) continue;
          await tx
            .update(schema.inventory)
            .set({ quantity: sql`${schema.inventory.quantity} + ${item.quantity}` })
            .where(
              and(
                eq(schema.inventory.productId, item.productId),
                eq(schema.inventory.trackInventory, true),
              ),
            );
        }
      }

      // Items and payments go with it (ON DELETE CASCADE).
      await tx.delete(schema.orders).where(eq(schema.orders.id, order.id));
    });

    await this.audit.record(actor, 'order.delete', 'order', order.orderNumber, {
      deleted: {
        from: `${order.orderNumber} (${order.status}, ${order.totalCents} ${order.currency})`,
        to: null,
      },
      ...(tookStock ? { stockRestored: { from: false, to: true } } : {}),
    });

    return { ok: true };
  }
}
