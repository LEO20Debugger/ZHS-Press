'use client';

import { useState } from 'react';
import { Button } from './primitives';
import { useCart } from './cart-provider';

export function AddToCart({ productId, title }: { productId: number; title: string }) {
  const { addItem, loading, error } = useCart();
  const [added, setAdded] = useState(false);

  async function onClick() {
    const ok = await addItem(productId);
    if (ok) {
      setAdded(true);
      // Reverts to the normal label so the button never looks stuck after the
      // customer has moved on and might want to add a second copy.
      setTimeout(() => setAdded(false), 2500);
    }
  }

  return (
    <div>
      <Button onClick={onClick} disabled={loading}>
        {loading ? 'Adding…' : added ? 'Added to cart ✓' : 'Add to cart'}
      </Button>
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
