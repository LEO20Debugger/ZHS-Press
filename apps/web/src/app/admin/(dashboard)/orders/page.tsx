'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import { IconView } from '@/components/admin/icons';
import { Modal } from '@/components/admin/modal';
import { OrderDetailPanel } from '@/components/admin/order-detail';
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
  const [openOrder, setOpenOrder] = useState<string | null>(null);

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
          Orders and customer details are restricted to admin accounts. Ask an administrator if
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
          <table className="w-full border-collapse text-small sm:min-w-[720px]">
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Order
                </th>
                {/*
                  Email and the item count drop out below sm. An email address
                  is the widest thing in this table and the least useful for the
                  job done from a phone — seeing what is paid, and opening an
                  order to act on it. Both return at sm, and everything dropped
                  here is in the order modal anyway.
                */}
                <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">
                  Email
                </th>
                <th scope="col" className="hidden py-3 pr-4 font-ui font-medium sm:table-cell">
                  Items
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Total
                </th>
                <th scope="col" className="py-3 pr-4 font-ui font-medium">
                  Status
                </th>
                {/*
                  Not an empty <th>: a header cell with no content leaves the
                  column unnamed, and a screen reader announcing a cell in it
                  reads the row with a blank where the column name should be.
                  The label is visually hidden because the actions speak for
                  themselves on screen.
                */}
                <th scope="col" className="py-3 text-right font-ui font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderNumber} className="border-b border-rule hover:bg-paper-deep">
                  {/*
                    The order number is a real <button>, not a click handler on
                    the row. A row is not focusable or announced as actionable,
                    so a keyboard user would have no way to open the detail —
                    and putting the handler on the row would also swallow clicks
                    meant for the fulfil action in the last cell.
                  */}
                  <td className="py-3 pr-4 font-ui">
                    <button
                      type="button"
                      onClick={() => setOpenOrder(order.orderNumber)}
                      className="link-underline whitespace-nowrap text-left font-ui"
                      aria-haspopup="dialog"
                    >
                      {order.orderNumber}
                    </button>
                  </td>
                  <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">{order.email}</td>
                  <td className="hidden py-3 pr-4 text-ink-muted sm:table-cell">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td className="py-3 pr-4">{formatMoney(order.totalCents, 'USD')}</td>
                  <td className="py-3 pr-4">{order.status}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-4">
                      {/*
                        Hidden below sm, where it wrapped onto two lines and
                        crowded the icon beside it. Nothing is lost: the modal
                        the icon opens carries the same action, so fulfilling
                        from a phone is one extra tap rather than unavailable.
                      */}
                      {order.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => void fulfil(order.orderNumber)}
                          className="link-underline hidden whitespace-nowrap text-caption sm:inline"
                        >
                          Mark fulfilled
                        </button>
                      ) : null}

                      {/*
                        The icon stands alone, so the accessible name lives on
                        the button — and names the order rather than saying
                        "View". A column of identical "View" buttons tells a
                        screen-reader user nothing about which one they are on.
                      */}
                      <button
                        type="button"
                        onClick={() => setOpenOrder(order.orderNumber)}
                        aria-haspopup="dialog"
                        aria-label={`View order ${order.orderNumber}`}
                        title="View order"
                        className="p-1 text-ink-muted transition-colors hover:text-ink focus-visible:text-ink"
                      >
                        <IconView size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={openOrder !== null}
        onClose={() => setOpenOrder(null)}
        title={openOrder ? `Order ${openOrder}` : 'Order'}
      >
        {openOrder ? (
          <OrderDetailPanel
            orderNumber={openOrder}
            onFulfilled={() => {
              // Close first, then refresh: the list is what the admin returns
              // to, and it must not still show the order as merely paid.
              setOpenOrder(null);
              void load();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
