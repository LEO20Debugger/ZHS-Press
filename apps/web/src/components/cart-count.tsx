'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './cart-provider';

const PULSE_MS = 520;

/**
 * A basket, drawn to sit beside the word rather than replace it.
 *
 * Inline SVG and not an icon package: this is the only glyph the storefront
 * header needs, and a set would bring a stroke weight and corner radius of its
 * own into a header drawn from one hand-set family. aria-hidden because the
 * link already says "Cart" — announcing a basket as well would just be the
 * same thing twice.
 */
function BasketIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {/* The basket itself, tapering slightly towards the base. */}
      <path d="M3.5 8.5h17l-1.6 9.9a1.5 1.5 0 0 1-1.5 1.3H6.6a1.5 1.5 0 0 1-1.5-1.3L3.5 8.5Z" />
      {/* The handle, rising out of the rim. */}
      <path d="M9 8.5V6a3 3 0 0 1 6 0v2.5" />
    </svg>
  );
}

export function CartCount() {
  const { cart } = useCart();
  const [pulsing, setPulsing] = useState(false);
  const previousCount = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = cart.itemCount;

    // null means this is the first render, where the count is being populated
    // from the server rather than added by the customer. Removing an item
    // should not celebrate either, so only an increase pulses.
    if (previous === null || cart.itemCount <= previous) return;

    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), PULSE_MS);
    return () => clearTimeout(timer);
  }, [cart.itemCount]);

  return (
    /*
      The underline sweep moves onto the label rather than the whole link:
      link-underline paints a background gradient across the element box, which
      on a flex row would draw a rule under the basket and the count badge too.
    */
    <Link href="/cart" className="inline-flex items-center gap-1.5 text-small">
      <BasketIcon />
      <span className="link-underline">Cart</span>
      {cart.itemCount > 0 ? (
        <span
          /* No margin: the row's gap already spaces the badge from the label. */
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-terracotta px-1.5 text-caption text-paper-raised ${
            pulsing ? 'cart-pulse' : ''
          }`}
        >
          {cart.itemCount}
        </span>
      ) : null}
      <span className="sr-only">
        {cart.itemCount === 1 ? ' (1 item)' : ` (${cart.itemCount} items)`}
      </span>
    </Link>
  );
}
