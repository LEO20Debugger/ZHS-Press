'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

interface Order {
  orderNumber: string;
  email: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: Array<{ titleSnapshot: string; quantity: number }>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden'>('loading');

  async function load() {
    const response = await fetch('/api/admin/admin/orders', { cache: 'no-store' });

    // An editor reaching this route gets a 403 from the API, not an empty
    // list. Hiding the nav link is presentation; this is the actual boundary.
    if (response.status === 403) {
      setState('forbidden');
      return;
    }

    setOrders(response.ok ? await response.json() : []);
    setState('ready');
  }

  useEffect(() => {
    void load();
  }, []);

  async function fulfil(orderNumber: string) {
    await fetch(`/api/admin/admin/orders/${orderNumber}/fulfil`, { method: 'PATCH' });
    await load();
  }

  if (state === 'forbidden') {
    return (
      <div>
        <Eyebrow>Orders</Eyebrow>
        <h1 className="mt-3 font-display text-display">Not available to your account.</h1>
        <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />
        <p className="prose-editorial mt-6 text-ink-muted">
          Orders and customer details are restricted to admin accounts. Ask the Press Director if
          you need access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow>Orders</Eyebrow>
      <h1 className="mt-3 font-display text-display">Orders</h1>
      <HandDrawnRule className="mt-4 max-w-[180px] text-terracotta" />

      {state === 'loading' ? (
        <p className="mt-8 text-small text-ink-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-small text-ink-muted">No orders yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-small">
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Order
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Email
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Items
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Total
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Status
                </th>
                <th scope="col" className="py-3 font-ui font-medium" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderNumber} className="border-b border-rule">
                  <td className="py-3 pr-4 font-ui">{order.orderNumber}</td>
                  <td className="py-3 pr-4 text-ink-muted">{order.email}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="py-3 pr-4">{formatMoney(order.totalCents, 'USD')}</td>
                  <td className="py-3 pr-4">{order.status}</td>
                  <td className="py-3">
                    {order.status === 'paid' ? (
                      <button
                        type="button"
                        onClick={() => void fulfil(order.orderNumber)}
                        className="link-underline text-caption"
                      >
                        Mark fulfilled
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
