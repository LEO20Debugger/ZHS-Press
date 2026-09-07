import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Cart session ownership.
 *
 * The Next server owns the cart token and keeps it in an httpOnly cookie, then
 * forwards it to the API as a header. Consequences worth stating:
 *
 * - Client-side JavaScript can never read the token, so an XSS bug cannot lift
 *   somebody's cart.
 * - The browser only ever talks to its own origin, so there is no CORS
 *   preflight on cart operations and the API host stays out of the bundle.
 */

export const CART_COOKIE = 'zhs_cart';
const CART_TTL_SECONDS = 30 * 24 * 60 * 60;

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export function generateCartToken(): string {
  return randomBytes(32).toString('hex');
}

/** Reads the existing token, or null. Does not create one. */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CART_TTL_SECONDS,
  };
}

/** Calls the cart API on behalf of the browser, carrying the session token. */
export async function callCartApi(
  path: string,
  token: string,
  init: { method: string; body?: unknown } = { method: 'GET' },
): Promise<Response> {
  return fetch(`${API_BASE_URL}/api${path}`, {
    method: init.method,
    headers: {
      'content-type': 'application/json',
      'x-cart-token': token,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
}
