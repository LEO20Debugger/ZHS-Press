'use client';

import { useEffect, useState } from 'react';
import { formatMoney, type Currency } from '@zhs/shared';

interface OrderItem {
  id: number;
  titleSnapshot: string;
  slugSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

interface Payment {
  id: number;
  provider: string;
  txRef: string;
  providerTxId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface Address {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface OrderDetail {
  orderNumber: string;
  email: string;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: Address | null;
  customerNote: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  items: OrderItem[];
  payments: Payment[];
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-small tabular-nums">{value}</dd>
    </div>
  );
}

function when(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The contents of the order modal.
 *
 * Fetches on mount rather than reusing the row from the list: the list carries
 * only titles and quantities, while the questions actually asked of this panel
 * — what was paid, to which address, against which transaction — need the
 * detail endpoint. It is one request, made only when a row is opened.
 */
export function OrderDetailPanel({
  orderNumber,
  onFulfilled,
}: {
  orderNumber: string;
  onFulfilled: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fulfilling, setFulfilling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetch(`/api/admin/admin/orders/${encodeURIComponent(orderNumber)}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // The modal can be closed before this resolves; setting state then
        // would warn and, worse, show the wrong order if another was opened.
        if (cancelled) return;
        setOrder(data);
        setState(data ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  async function fulfil() {
    setFulfilling(true);
    await fetch(`/api/admin/admin/orders/${encodeURIComponent(orderNumber)}/fulfil`, {
      method: 'PATCH',
    });
    setFulfilling(false);
    onFulfilled();
  }

  if (state === 'loading') {
    return <p className="p-6 text-small text-ink-muted">Loading order…</p>;
  }

  if (state === 'error' || !order) {
    return <p className="p-6 text-small text-danger">That order could not be loaded.</p>;
  }

  const currency = order.currency as Currency;

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 flex items-baseline justify-between gap-4 border-b border-rule bg-paper-raised px-6 py-4">
        <div>
          <h2 className="font-display text-h3">{order.orderNumber}</h2>
          <p className="mt-0.5 text-caption text-ink-muted">{when(order.createdAt)}</p>
        </div>
        <span className="shrink-0 border border-rule px-2 py-1 text-caption uppercase tracking-wider">
          {order.status}
        </span>
      </div>

      <div className="space-y-6 px-6 py-5">
        <section>
          <h3 className="eyebrow">Items</h3>
          <table className="mt-3 w-full border-collapse text-small">
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-rule align-top">
                  <td className="py-2 pr-3">
                    {item.titleSnapshot}
                    {item.quantity > 1 ? (
                      <span className="block text-caption text-ink-muted">
                        {item.quantity} × {formatMoney(item.unitPriceCents, currency)}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right tabular-nums">
                    {formatMoney(item.lineTotalCents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3">
            <Row label="Subtotal" value={formatMoney(order.subtotalCents, currency)} />
            <Row label="Shipping" value={formatMoney(order.shippingCents, currency)} />
            {order.taxCents > 0 ? (
              <Row label="Tax" value={formatMoney(order.taxCents, currency)} />
            ) : null}
            <div className="mt-1 flex justify-between gap-4 border-t border-ink pt-2">
              <dt className="font-ui text-small font-semibold">Total</dt>
              <dd className="font-ui text-small font-semibold tabular-nums">
                {formatMoney(order.totalCents, currency)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="eyebrow">Customer</h3>
            <p className="mt-2 break-words text-small">{order.email}</p>
            {order.shippingAddress ? (
              <address className="mt-3 not-italic text-small leading-relaxed text-ink-muted">
                {[
                  order.shippingAddress.name,
                  order.shippingAddress.line1,
                  order.shippingAddress.line2,
                  [order.shippingAddress.city, order.shippingAddress.region]
                    .filter(Boolean)
                    .join(', '),
                  order.shippingAddress.postalCode,
                  order.shippingAddress.country,
                ]
                  .filter(Boolean)
                  .map((line) => (
                    <span key={String(line)} className="block">
                      {line}
                    </span>
                  ))}
                {order.shippingAddress.phone ? (
                  <span className="mt-1 block">{order.shippingAddress.phone}</span>
                ) : null}
              </address>
            ) : (
              <p className="mt-3 text-caption text-ink-muted">No shipping address recorded.</p>
            )}
          </div>

          <div>
            <h3 className="eyebrow">Timeline</h3>
            <dl className="mt-2">
              <Row label="Placed" value={when(order.createdAt)} />
              <Row label="Paid" value={when(order.paidAt)} />
              <Row label="Fulfilled" value={when(order.fulfilledAt)} />
            </dl>
          </div>
        </section>

        {order.customerNote ? (
          <section>
            <h3 className="eyebrow">Customer note</h3>
            <p className="mt-2 whitespace-pre-wrap text-small">{order.customerNote}</p>
          </section>
        ) : null}

        {order.payments.length > 0 ? (
          <section>
            <h3 className="eyebrow">Payments</h3>
            {order.payments.map((payment) => (
              <dl key={payment.id} className="mt-2 border-t border-rule pt-2">
                <Row label="Status" value={payment.status} />
                <Row
                  label="Amount"
                  value={formatMoney(payment.amountCents, payment.currency as Currency)}
                />
                {/*
                  The provider reference is the thing you quote to Flutterwave
                  support when a customer says they paid and the order says
                  otherwise, so it is shown in full rather than truncated.
                */}
                <Row label="Reference" value={payment.txRef} />
                <Row label="Provider ID" value={payment.providerTxId ?? '—'} />
              </dl>
            ))}
          </section>
        ) : (
          <p className="text-caption text-ink-muted">No payment recorded against this order.</p>
        )}
      </div>

      {order.status === 'paid' ? (
        <div className="sticky bottom-0 border-t border-rule bg-paper-raised px-6 py-4">
          <button
            type="button"
            onClick={() => void fulfil()}
            disabled={fulfilling}
            className="border border-ink bg-ink px-4 py-2 font-ui text-small text-paper-raised disabled:opacity-60"
          >
            {fulfilling ? 'Marking…' : 'Mark fulfilled'}
          </button>
          <p className="mt-2 text-caption text-ink-muted">
            This emails the customer to say their order is on its way.
          </p>
        </div>
      ) : null}
    </div>
  );
}
