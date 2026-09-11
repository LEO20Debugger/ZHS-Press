import { NextResponse } from 'next/server';
import { callCartApi, readCartToken } from '@/lib/cart-session';

const EMPTY = { lines: [], subtotalCents: 0, currency: 'USD', itemCount: 0 };

export async function GET() {
  const token = await readCartToken();
  // No cookie means no cart yet. That is an empty cart, not an error.
  if (!token) return NextResponse.json(EMPTY);

  const response = await callCartApi('/cart', token);
  if (!response.ok) return NextResponse.json(EMPTY);

  return NextResponse.json(await response.json());
}

/** Empties the cart. The session cookie stays, so adding again just works. */
export async function DELETE() {
  const token = await readCartToken();
  // Nothing to empty. Reporting success is honest — the cart is empty either
  // way, and an error here would only be something for the UI to display.
  if (!token) return NextResponse.json(EMPTY);

  try {
    const response = await callCartApi('/cart', token, { method: 'DELETE' });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: 'Could not empty your cart.' },
        { status: response.status },
      );
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Could not reach the shop. Please try again.' },
      { status: 502 },
    );
  }
}
