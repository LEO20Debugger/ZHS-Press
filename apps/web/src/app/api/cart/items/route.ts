import { NextResponse, type NextRequest } from 'next/server';
import {
  CART_COOKIE,
  callCartApi,
  cartCookieOptions,
  generateCartToken,
  readCartToken,
} from '@/lib/cart-session';

/**
 * In fixture mode the catalogue comes from apps/web/src/lib/fixtures.ts while
 * the cart would go to the real API — two different sources with unrelated
 * product ids. Adding fixture id 3 (Bloom) would look up database id 3 (Light,
 * Issue Four) and silently add the wrong item, or 400 for ids the database has
 * never heard of.
 *
 * The cart is therefore refused outright rather than allowed to half-work.
 */
const USE_FIXTURES = process.env.USE_FIXTURES === 'true';

const FIXTURE_MODE_MESSAGE =
  'The shop is in preview mode and the cart is disabled. ' +
  'Set USE_FIXTURES=false and point API_BASE_URL at the API to enable it.';

function fixtureModeResponse() {
  return NextResponse.json({ ok: false, message: FIXTURE_MODE_MESSAGE }, { status: 503 });
}

/** Adds an item, minting a cart token on first use. */
export async function POST(request: NextRequest) {
  if (USE_FIXTURES) return fixtureModeResponse();

  const existing = await readCartToken();
  const token = existing ?? generateCartToken();

  let response: Response;
  try {
    response = await callCartApi('/cart/items', token, {
      method: 'POST',
      body: await request.json(),
    });
  } catch {
    // The API is unreachable. 502 is honest; letting the fetch throw would
    // surface a 500 stack trace that looks like a bug in this app.
    return NextResponse.json(
      { ok: false, message: 'The shop is unavailable right now. Please try again.' },
      { status: 502 },
    );
  }

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
  if (USE_FIXTURES) return fixtureModeResponse();

  const token = await readCartToken();
  if (!token) {
    return NextResponse.json({ ok: false, message: 'No cart session' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await callCartApi('/cart/items', token, {
      method: 'PUT',
      body: await request.json(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Could not update your cart. Please try again.' },
      { status: 502 },
    );
  }

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.ok ? 200 : response.status });
}
