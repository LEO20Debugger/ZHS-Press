'use client';

import { useState } from 'react';
import { Button } from './primitives';
import { useCart } from './cart-provider';

/** How long the confirmation label stays before reverting. */
const CONFIRM_MS = 2500;

/**
 * Persistent "already in your cart" marker.
 *
 * Separate from the button's transient "Added ✓", which reverts after a couple
 * of seconds so the control never looks stuck. That flash answers "did my click
 * work"; this answers "do I already have this", which is a different question
 * and is still worth answering on a later visit, on another page, or after a
 * reload. Reading the server-owned cart means it cannot drift from the cart
 * page.
 *
 * Not a live region: it is a standing fact about the page, and the button
 * already announces the change that caused it.
 */
function InCart({ quantity, className = '' }: { quantity: number; className?: string }) {
  if (quantity < 1) return null;

  return (
    <p className={`font-ui text-caption text-moss ${className}`}>
      <span aria-hidden="true">✓ </span>
      {quantity === 1 ? 'In your cart' : `In your cart × ${quantity}`}
    </p>
  );
}

/** Full-width add button for a product detail page. */
export function AddToCart({ productId, title }: { productId: number; title: string }) {
  const { addItem, loading, error, quantityOf } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = quantityOf(productId);

  async function onClick() {
    const ok = await addItem(productId);
    if (ok) {
      setAdded(true);
      // Reverts so the button never looks stuck after the customer has moved
      // on and might want a second copy.
      setTimeout(() => setAdded(false), CONFIRM_MS);
    }
  }

  return (
    <div>
      <Button onClick={onClick} disabled={loading}>
        {loading ? 'Adding…' : added ? 'Added to cart ✓' : inCart ? 'Add another' : 'Add to cart'}
      </Button>
      <InCart quantity={inCart} className="mt-3" />
      {error ? (
        <p role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {added ? `${title} added to your cart` : ''}
      </span>
    </div>
  );
}

/**
 * Compact add button for a grid card.
 *
 * Always visible rather than revealed on hover: hover does not exist on touch,
 * and a control you can only find with a mouse is not really there.
 *
 * The accessible name carries the product title. In a grid of nine cards, nine
 * buttons all named "Add" are useless to anyone navigating by control.
 */
export function QuickAdd({ productId, title }: { productId: number; title: string }) {
  const { addItem, loading, quantityOf } = useCart();
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'failed'>('idle');
  const inCart = quantityOf(productId);

  async function onClick() {
    setState('busy');
    const ok = await addItem(productId);

    if (!ok) {
      // The provider holds the real reason (stock, availability). The card is
      // too small for it, so point at the page that can explain.
      setState('failed');
      setTimeout(() => setState('idle'), CONFIRM_MS);
      return;
    }

    setState('added');
    setTimeout(() => setState('idle'), CONFIRM_MS);
  }

  const label =
    state === 'busy'
      ? 'Adding…'
      : state === 'added'
        ? 'Added ✓'
        : state === 'failed'
          ? 'Unavailable'
          : inCart
            ? 'Add another'
            : 'Add to cart';

  return (
    /*
      The live region is a sibling, not a child of the button. Nested inside,
      its text becomes part of the button's content and screen readers can
      announce the change twice — once as the region updating, once as the
      button's name changing.
    */
    <>
      <InCart quantity={inCart} className="mb-2" />
      <button
        type="button"
        onClick={onClick}
        disabled={loading || state === 'busy'}
        aria-label={
          inCart ? `Add another ${title} to cart` : `Add ${title} to cart`
        }
        className={`press w-full rounded-pill border px-4 py-2 font-ui text-caption uppercase tracking-wide transition-colors duration-base ease-out disabled:opacity-50 ${
          state === 'added'
            ? 'border-moss bg-moss text-paper-raised'
            : state === 'failed'
              ? 'border-danger text-danger'
              : 'border-rule text-ink-muted hover:border-ink hover:bg-ink hover:text-paper'
        }`}
      >
        {label}
      </button>
      <span aria-live="polite" className="sr-only">
        {state === 'added' ? `${title} added to your cart` : ''}
      </span>
    </>
  );
}
