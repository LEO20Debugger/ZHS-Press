import type { Metadata } from 'next';
import { OrderStatusPanel } from '@/components/order-status';

export const metadata: Metadata = {
  title: 'Your order',
  // The order number is the only thing guarding this page. Keep it out of
  // search results entirely.
  robots: { index: false, follow: false },
};

/**
 * Where Flutterwave sends the customer back after payment.
 *
 * The query parameters on that redirect are attacker-controlled and are
 * deliberately ignored — this page reads the order's real status from our own
 * API instead. If the webhook has not landed yet the panel says "confirming"
 * and polls; it never claims a payment succeeded because a URL said so.
 */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <OrderStatusPanel orderNumber={orderNumber} />;
}
