'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './cart-provider';

const PULSE_MS = 520;

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
    <Link href="/cart" className="link-underline text-small">
      Cart
      {cart.itemCount > 0 ? (
        <span
          className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-terracotta px-1.5 text-caption text-paper-raised ${
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
