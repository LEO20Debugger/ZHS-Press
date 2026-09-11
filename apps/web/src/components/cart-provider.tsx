'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartView } from '@zhs/shared';

const EMPTY_CART: CartView = { lines: [], subtotalCents: 0, currency: 'USD', itemCount: 0 };

interface CartContextValue {
  cart: CartView;
  loading: boolean;
  error: string | null;
  addItem: (productId: number, quantity?: number) => Promise<boolean>;
  updateItem: (productId: number, quantity: number) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart state.
 *
 * The server is the only authority on what a cart contains and what it costs;
 * every mutation returns the recomputed cart and that response replaces local
 * state wholesale. Nothing is optimistically calculated on the client, because
 * a cart total that briefly disagrees with the server is a support ticket.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartView>(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/cart', { cache: 'no-store' });
      if (response.ok) setCart((await response.json()) as CartView);
    } catch {
      // A failed refresh leaves the last known cart in place rather than
      // blanking it, which would look like the customer's items vanished.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId: number, quantity = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // Surfaces the API's real reason — "Only 2 left in stock" is far more
        // useful than a generic failure.
        setError(payload?.message ?? 'Could not add that item.');
        return false;
      }

      setCart(payload as CartView);
      return true;
    } catch {
      setError('Could not reach the shop. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (productId: number, quantity: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cart/items', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      if (response.ok) setCart((await response.json()) as CartView);
    } catch {
      setError('Could not update your cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Empties the cart in one request.
   *
   * Deliberately not a loop of `updateItem(id, 0)`: that is one round trip per
   * line, and a failure partway through leaves the customer looking at a cart
   * that is neither what they had nor empty.
   */
  const clear = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cart', { method: 'DELETE' });
      if (response.ok) {
        setCart((await response.json()) as CartView);
      } else {
        const payload = await response.json().catch(() => null);
        setError(payload?.message ?? 'Could not empty your cart.');
      }
    } catch {
      setError('Could not empty your cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ cart, loading, error, addItem, updateItem, clear, refresh }),
    [cart, loading, error, addItem, updateItem, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
