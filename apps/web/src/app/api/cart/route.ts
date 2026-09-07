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
