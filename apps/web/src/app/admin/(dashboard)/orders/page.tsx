'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import { IconTrash, IconView } from '@/components/admin/icons';
import { Modal } from '@/components/admin/modal';
import { OrderDetailPanel } from '@/components/admin/order-detail';
import { Pager, pageInfoOf, usePageNumber, type PageInfo } from '@/components/admin/pager';
import { Eyebrow, HandDrawnRule } from '@/components/primitives';

interface Order {
  orderNumber: string;
  email: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: Array<{ titleSnapshot: string; quantity: number }>;
  /** Paid in Stripe's sandbox — no real money moved. */
  isTest: boolean;
  /** Unpaid, or a sandbox order. Real sales are never deletable. */
  deletable: boolean;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [page, setPage] = usePageNumber('zhs-admin-orders-page');
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden'>('loading');
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  /*
   * Which row is armed for deletion. A single order number rather than a
   * per-row flag: arming a second row disarms the first, so there is never
   * more than one live delete button on screen.
   */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ orderNumber: string; message: string } | null>(null);

  const load = useCallback(async () => {
    if (page == null) return;
    const response = await fetch(`/api/admin/admin/orders?page=${page}`, { cache: 'no-store' });

    // An editor reaching this route gets a 403 from the API, not an empty
    // list. Hiding the nav link is presentation; this is the actual boundary.
    if (response.status === 403) {
      setState('forbidden');
      return;
    }

    const body = response.ok ? await response.json() : null;
    const pageInfo = pageInfoOf(body);

    // A page past the end — its last order just deleted, say — steps back to
    // the last page that exists instead of showing an empty table.
    if (pageInfo && page > pageInfo.totalPages) {
      setPage(pageInfo.totalPages);
      return;
    }

    setOrders(body?.items ?? []);
    setInfo(pageInfo);
    setState('ready');
  }, [page, setPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function fulfil(orderNumber: string) {
    await fetch(`/api/admin/admin/orders/${orderNumber}/fulfil`, { method: 'PATCH' });
    await load();
  }

  /*
   * The API decides what may be deleted, and explains a refusal — so the
   * message is shown on the row rather than swallowed.
   */
  async function remove(orderNumber: string) {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/admin/admin/orders/${encodeURIComponent(orderNumber)}`, {
      method: 'DELETE',
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError({ orderNumber, message: payload?.message ?? `Could not delete ${orderNumber}.` });
      return;
    }

    setConfirming(null);
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
                  <td className="py-3 pr-4">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {order.status}
                      {/*
                        Marked, so a sandbox order is never mistaken for a sale
                        when reading the list — and so it is obvious which ones
                        to clear out before launch.
                      */}
                      {order.isTest ? (
                        <span className="rounded-pill border border-rule px-2 py-0.5 text-caption text-ink-muted">
                          Test
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-3 align-top">
                    {confirming === order.orderNumber ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex flex-wrap justify-end gap-3 font-ui text-caption">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void remove(order.orderNumber)}
                            className="text-danger underline underline-offset-2 disabled:opacity-50"
                          >
                            {busy ? 'Deleting…' : 'Delete for good'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setConfirming(null);
                              setError(null);
                            }}
                            className="text-ink-muted underline underline-offset-2 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {error?.orderNumber === order.orderNumber ? (
                          <p role="alert" className="max-w-[32ch] text-right font-ui text-caption text-danger">
                            {error.message}
                          </p>
                        ) : null}
                      </div>
                    ) : (
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

                        {/*
                          Only offered where the API would allow it — unpaid and
                          sandbox orders. A real sale shows no delete at all
                          rather than a button that can only ever refuse.
                        */}
                        {/*
                          An icon, like View beside it, so the two row actions
                          read as a matching pair. Its name lives on the button
                          and says which order — a column of identical "Delete"
                          labels tells a screen-reader user nothing. The
                          two-step confirm still follows in words, because that
                          is the moment that must not be misread.
                        */}
                        {order.deletable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirming(order.orderNumber);
                              setError(null);
                            }}
                            aria-label={`Delete order ${order.orderNumber}`}
                            title="Delete order"
                            className="p-1 text-ink-muted transition-colors hover:text-danger focus-visible:text-danger"
                          >
                            <IconTrash size={18} />
                          </button>
                        ) : (
                          // Holds the column's width, so the View icons line up
                          // down the table whether or not a row can be deleted.
                          <span aria-hidden="true" className="inline-block w-[26px]" />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        info={state === 'ready' ? info : null}
        onPage={(next) => {
          setPage(next);
          setConfirming(null);
        }}
        label="Order pages"
      />

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
