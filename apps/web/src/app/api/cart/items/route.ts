import { NextResponse, type NextRequest } from 'next/server';
import {
  CART_COOKIE,
  callCartApi,
  cartCookieOptions,
  generateCartToken,
  readCartToken,
} from '@/lib/cart-session';

/** Adds an item, minting a cart token on first use. */
export async function POST(request: NextRequest) {
  const existing = await readCartToken();
  const token = existing ?? generateCartToken();

  const response = await callCartApi('/cart/items', token, {
    method: 'POST',
    body: await request.json(),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, message: payload?.message ?? 'Could not add that item.' },
      { status: response.status },
    );
  }

  const result = NextResponse.json(payload);
  // Only set the cookie once the API has accepted the item, so a rejected add
  // does not leave an empty cart session behind.
  if (!existing) result.cookies.set(CART_COOKIE, token, cartCookieOptions());
  return result;
}

export async function PUT(request: NextRequest) {
  const token = await readCartToken();
  if (!token) {
    return NextResponse.json({ ok: false, message: 'No cart session' }, { status: 400 });
  }

  const response = await callCartApi('/cart/items', token, {
    method: 'PUT',
    body: await request.json(),
  });

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
}
