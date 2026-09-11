'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney } from '@zhs/shared';
import { useCart } from '@/components/cart-provider';
import { Button, Eyebrow, HandDrawnRule } from '@/components/primitives';

/**
 * "Empty cart", with a confirmation step.
 *
 * Two clicks rather than one, because the button sits directly under a list of
 * per-line Remove links and is the only irreversible control on the page — a
 * misaimed click should not discard a cart someone spent ten minutes filling.
 * The confirmation is inline rather than a `window.confirm`: a native dialog is
 * unstyleable, reads as a browser warning rather than part of the shop, and
 * behaves inconsistently on mobile.
 */
function EmptyCart() {
  const { clear, loading } = useCart();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="link-underline text-caption text-ink-muted"
      >
        Empty cart
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-caption text-ink-muted">Remove everything?</span>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          await clear();
          setConfirming(false);
        }}
        className="link-underline text-caption text-danger disabled:opacity-50"
      >
        {loading ? 'Emptying…' : 'Yes, empty it'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="link-underline text-caption text-ink-muted"
      >
        Keep them
      </button>
    </div>
  );
}

export default function CartPage() {
  const { cart, updateItem, loading, error } = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="shell py-24">
        <Eyebrow>Cart</Eyebrow>
        <h1 className="mt-4 text-display">Your cart is empty.</h1>
        <HandDrawnRule className="mt-5 max-w-[200px] text-terracotta" />
        <p className="prose-editorial mt-6 text-ink-muted">
          Nothing in here yet. The shop has our books, issues of <em>Light</em>, and journals.
        </p>
        <div className="mt-8">
          <Button href="/shop">Visit the shop</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-16 md:py-24">
      <Eyebrow>Cart</Eyebrow>
      <h1 className="mt-4 text-display">Your cart</h1>
      <HandDrawnRule className="mt-5 max-w-[200px] text-terracotta" />

      {error ? (
        <p role="alert" className="mt-6 text-small text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-12 grid gap-16 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <ul className="divide-y divide-rule border-y border-rule">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex gap-6 py-6">
              <div className="cover-frame h-32 w-24 shrink-0 bg-paper-deep">
                {line.coverImage ? (
                  <Image
                    src={line.coverImage.url}
                    alt={line.coverImage.alt}
                    width={96}
                    height={128}
                    sizes="96px"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h2 className="font-display text-h3">{line.title}</h2>
                  <p className="mt-1 text-small text-ink-muted">
                    {formatMoney(line.unitPriceCents, cart.currency)} each
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <label htmlFor={`qty-${line.productId}`} className="sr-only">
                    Quantity for {line.title}
                  </label>
                  <select
                    id={`qty-${line.productId}`}
                    value={line.quantity}
                    disabled={loading}
                    onChange={(event) =>
                      void updateItem(line.productId, Number(event.target.value))
                    }
                    className="border border-rule bg-paper-raised px-3 py-1.5 font-ui text-small focus:border-ink focus:outline-none"
                  >
                    {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void updateItem(line.productId, 0)}
                    className="link-underline text-caption text-ink-muted disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="whitespace-nowrap font-ui text-small">
                {formatMoney(line.lineTotalCents, cart.currency)}
              </p>
            </li>
          ))}
          </ul>

          <div className="mt-6 flex justify-end">
            <EmptyCart />
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="eyebrow">Summary</h2>

          <dl className="mt-5 space-y-3">
            <div className="flex justify-between">
              <dt className="text-small text-ink-muted">Subtotal</dt>
              <dd className="text-small">{formatMoney(cart.subtotalCents, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-small text-ink-muted">Shipping</dt>
              <dd className="text-small text-ink-muted">Calculated at checkout</dd>
            </div>
          </dl>

          <div className="mt-6 flex justify-between border-t border-ink pt-4">
            <span className="font-display text-h3">Total</span>
            <span className="font-display text-h3">
              {formatMoney(cart.subtotalCents, cart.currency)}
            </span>
          </div>

          <div className="mt-8">
            <Button href="/checkout" className="w-full">
              Checkout
            </Button>
          </div>

          <p className="mt-4 text-center text-caption text-ink-muted">
            <Link href="/shop" className="link-underline">
              Continue shopping
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
