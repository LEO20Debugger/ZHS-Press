'use client';

import Link from 'next/link';
import { useCart } from './cart-provider';

export function CartCount() {
  const { cart } = useCart();

  return (
    <Link href="/cart" className="link-underline text-small">
      Cart
      {cart.itemCount > 0 ? (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-terracotta px-1.5 text-caption text-paper-raised">
          {cart.itemCount}
        </span>
      ) : null}
      <span className="sr-only">
        {cart.itemCount === 1 ? ' (1 item)' : ` (${cart.itemCount} items)`}
      </span>
    </Link>
  );
}
