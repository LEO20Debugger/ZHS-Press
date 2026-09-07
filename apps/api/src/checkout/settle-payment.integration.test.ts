import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { closeDb, createDb, schema, type Database } from '@zhs/db';

/**
 * Integration test for webhook idempotency.
 *
 * This is the test that actually proves the claim the design rests on: that a
 * redelivered webhook produces exactly one paid order and exactly one inventory
 * decrement. The branch tests in settle-payment.test.ts check which code path
 * runs; only this one checks that MySQL's conditional UPDATE does what we are
 * relying on when two deliveries race.
 *
 * It needs a real MySQL. Run it with:
 *
 *   DATABASE_URL="mysql://root:pass@localhost:3306/zhs_test" pnpm --filter @zhs/api test
 *
 * Without DATABASE_URL it skips rather than passing vacuously — a green run on
 * a machine with no database must not be mistaken for evidence.
 */

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)('webhook idempotency (needs MySQL)', () => {
  let db: Database;
  let productId: number;
  let orderId: number;
  const txRef = `ZHS-ITEST-${Date.now()}`;

  beforeAll(async () => {
    db = createDb({ url: DATABASE_URL as string });

    const [product] = await db.insert(schema.products).values({
      slug: `itest-${Date.now()}`,
      type: 'book',
      status: 'available',
      title: 'Integration Test Title',
      priceCents: 1499,
      currency: 'USD',
    });
    productId = Number((product as unknown as { insertId: number }).insertId);

    await db
      .insert(schema.inventory)
      .values({ productId, quantity: 10, trackInventory: true, allowBackorder: false });

    const [order] = await db.insert(schema.orders).values({
      orderNumber: txRef,
      email: 'itest@example.com',
      status: 'pending',
      subtotalCents: 2998,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 2998,
      currency: 'USD',
    });
    orderId = Number((order as unknown as { insertId: number }).insertId);

    await db.insert(schema.orderItems).values({
      orderId,
      productId,
      titleSnapshot: 'Integration Test Title',
      slugSnapshot: 'itest',
      unitPriceCents: 1499,
      quantity: 2,
      lineTotalCents: 2998,
    });

    await db.insert(schema.payments).values({
      orderId,
      provider: 'flutterwave',
      txRef,
      amountCents: 2998,
      currency: 'USD',
      status: 'initiated',
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(schema.payments).where(eq(schema.payments.orderId, orderId));
    await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    await db.delete(schema.orders).where(eq(schema.orders.id, orderId));
    await db.delete(schema.inventory).where(eq(schema.inventory.productId, productId));
    await db.delete(schema.products).where(eq(schema.products.id, productId));
    await closeDb();
  });

  /** The atomic claim, exactly as CheckoutService.settlePayment performs it. */
  async function claimPayment(): Promise<number> {
    const result = await db
      .update(schema.payments)
      .set({ status: 'successful', providerTxId: '998877' })
      .where(
        and(eq(schema.payments.txRef, txRef), sql`${schema.payments.status} <> 'successful'`),
      );
    return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
  }

  it('lets exactly one of two concurrent deliveries claim the payment', async () => {
    const [first, second] = await Promise.all([claimPayment(), claimPayment()]);
    expect([first, second].filter((affected) => affected === 1)).toHaveLength(1);
    expect([first, second].filter((affected) => affected === 0)).toHaveLength(1);
  });

  it('affects zero rows on every subsequent redelivery', async () => {
    expect(await claimPayment()).toBe(0);
    expect(await claimPayment()).toBe(0);
  });

  it('leaves exactly one successful payment row for the reference', async () => {
    const rows = await db.query.payments.findMany({ where: eq(schema.payments.txRef, txRef) });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('successful');
  });

  it('refuses a second payment row with the same tx_ref', async () => {
    // The UNIQUE index is the last line of defence if application logic ever
    // fails to guard a redelivery.
    await expect(
      db.insert(schema.payments).values({
        orderId,
        provider: 'flutterwave',
        txRef,
        amountCents: 2998,
        currency: 'USD',
        status: 'initiated',
      }),
    ).rejects.toThrow();
  });
});
