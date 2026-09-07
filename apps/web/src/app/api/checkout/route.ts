import { NextResponse, type NextRequest } from 'next/server';
import { callCartApi, readCartToken } from '@/lib/cart-session';

/**
 * Starts checkout and returns the Flutterwave payment link.
 *
 * The body carries contact and address details only. No prices, no totals —
 * the API loads the cart server-side and recomputes everything.
 */
export async function POST(request: NextRequest) {
  const token = await readCartToken();
  if (!token) {
    return NextResponse.json({ ok: false, message: 'Your cart is empty.' }, { status: 400 });
  }

  const response = await callCartApi('/checkout', token, {
    method: 'POST',
    body: await request.json(),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: payload?.message ?? 'Could not start checkout.',
        errors: payload?.errors ?? null,
      },
      { status: response.status },
    );
  }

  return NextResponse.json(payload);
}
