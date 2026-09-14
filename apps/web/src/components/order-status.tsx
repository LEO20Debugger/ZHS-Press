'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@zhs/shared';
import type { OrderView } from '@zhs/shared';
import { Button, Eyebrow, HandDrawnRule } from './primitives';
import { useCart } from './cart-provider';

/** Poll while the webhook is in flight, then stop. */
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 90_000;

type Phase = 'loading' | 'confirming' | 'paid' | 'failed' | 'missing';

export function OrderStatusPanel({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const { refresh } = useCart();
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
          cache: 'no-store',
        });

        if (cancelled) return;

        if (response.status === 404) {
          setPhase('missing');
          return;
        }

        const data = (await response.json()) as OrderView;
        setOrder(data);

        if (data.status === 'paid' || data.status === 'fulfilled') {
          setPhase('paid');
          // Settlement empties the basket this order came from, in the same
          // transaction that marks it paid. Re-read so the header badge agrees.
          void refresh();
          return;
        }

        if (data.status === 'failed' || data.status === 'cancelled') {
          setPhase('failed');
          return;
        }

        // Still pending. The webhook may simply not have arrived yet — that is
        // normal for a few seconds, so keep waiting rather than declaring
        // failure.
        setPhase('confirming');

        if (Date.now() - startedAt.current < MAX_POLL_MS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setPhase('confirming');
      }
    }

    /*
     * Flutterwave sends the customer back with ?transaction_id=… on the URL.
     * That parameter proves nothing on its own — anyone can type it — so it is
     * handed to the API purely as a pointer, and the API verifies it with
     * Flutterwave before anything settles.
     *
     * This runs once, before polling, and only covers the case where the
     * webhook has not arrived. If it has, the API sees a non-pending order and
     * returns immediately without calling out.
     *
     * Read from window.location rather than useSearchParams: this is a
     * client-only effect, and useSearchParams would force the whole page under
     * a Suspense boundary for a value we only need after mount.
     */
    async function start() {
      const transactionId = new URLSearchParams(window.location.search).get('transaction_id');

      if (transactionId && /^\d{1,32}$/.test(transactionId)) {
        try {
          await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/reconcile`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ transactionId }),
          });
        } catch {
          // Nothing to do — poll() below reads the real status either way.
        }
      }

      if (!cancelled) void poll();
    }

    void start();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderNumber, refresh]);

  if (phase === 'missing') {
    return (
      <Shell title="We could not find that order.">
        <p className="prose-editorial mt-6 text-ink-muted">
          Check the link in your confirmation email, or write to{' '}
          <a href="mailto:info@zhspress.org" className="link-underline">
            info@zhspress.org
          </a>{' '}
          quoting <strong>{orderNumber}</strong>.
        </p>
      </Shell>
    );
  }

  if (phase === 'loading' || phase === 'confirming') {
    return (
      <Shell title="Confirming your payment…">
        <p className="prose-editorial mt-6 text-ink-muted" aria-live="polite">
          This usually takes a few seconds. You can safely leave this page — we will email you at
          the address you gave us either way. Your order is <strong>{orderNumber}</strong>.
        </p>
      </Shell>
    );
  }

  if (phase === 'failed') {
    return (
      <Shell title="That payment did not go through.">
        <p className="prose-editorial mt-6 text-ink-muted">
          Nothing has been charged. Your order number was <strong>{orderNumber}</strong>.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button href="/cart">Back to cart</Button>
          <Button href="/shop" variant="outline">
            Keep browsing
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Thank you — your order is confirmed.">
      <p className="prose-editorial mt-6 text-ink-muted">
        We have emailed a receipt to <strong>{order?.email}</strong>. Your order number is{' '}
        <strong>{orderNumber}</strong>.
      </p>

      {order ? (
        <div className="mt-12 max-w-xl">
          <h2 className="eyebrow">What you ordered</h2>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {order.items.map((item) => (
              <li key={item.slugSnapshot} className="flex justify-between gap-4 py-3">
                <span className="text-small">
                  {item.titleSnapshot}
                  <span className="text-ink-muted"> × {item.quantity}</span>
                </span>
                <span className="whitespace-nowrap text-small">
                  {formatMoney(item.lineTotalCents, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2">
            <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
            <Row
              label="Shipping"
              value={
                order.shippingCents === 0
                  ? 'Free'
                  : formatMoney(order.shippingCents, order.currency)
              }
            />
          </dl>

          <div className="mt-4 flex justify-between border-t border-ink pt-4">
            <span className="font-display text-h3">Total</span>
            <span className="font-display text-h3">
              {formatMoney(order.totalCents, order.currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <Button href="/shop" variant="outline">
          Continue shopping
        </Button>
      </div>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="text-small">{value}</dd>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shell py-16 md:py-24">
      <Eyebrow>Order</Eyebrow>
      <h1 className="mt-4 text-display">{title}</h1>
      <HandDrawnRule className="mt-5 max-w-[220px] text-terracotta" />
      {children}
    </div>
  );
}
