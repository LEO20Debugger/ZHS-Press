import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Fallback settlement for the confirmation page.
 *
 * Called once when the customer returns from Flutterwave carrying a
 * transaction id, to cover a webhook that has not arrived. The API does the
 * verifying; this only forwards.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.transactionId !== 'string') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/orders/${encodeURIComponent(orderNumber)}/reconcile`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: body.transactionId }),
        cache: 'no-store',
      },
    );

    if (response.status === 404) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!response.ok) {
      return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
    }

    return NextResponse.json(await response.json());
  } catch {
    // The page falls back to polling, so a failure here is not worth
    // surfacing: the webhook may still land.
    return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  }
}
