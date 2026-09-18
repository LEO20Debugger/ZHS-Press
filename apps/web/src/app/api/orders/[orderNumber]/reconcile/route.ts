import { revalidateTag } from 'next/cache';
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

    /*
     * Pass the API's own status and message through rather than flattening
     * everything to 502. A rejected transaction id is a 400 with a reason, and
     * reporting that as "Unavailable" sent a real debugging session looking at
     * the network instead of at the argument.
     */
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      return NextResponse.json(
        { message: detail?.message ?? 'Unavailable' },
        { status: response.status },
      );
    }

    /*
     * A settlement here has just decremented stock, and may have flipped a
     * title to sold out. Expire the catalogue so the storefront stops offering
     * what was only just bought, instead of waiting out the 60s window.
     *
     * Unconditional on success, including the already-settled case: this runs
     * once per customer returning from payment, which is far too rare to be
     * worth distinguishing, and re-fetching a catalogue costs less than
     * reasoning about which of two paths did the decrementing.
     */
    revalidateTag('catalog');

    return NextResponse.json(await response.json());
  } catch {
    // The page falls back to polling, so a failure here is not worth
    // surfacing: the webhook may still land.
    return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  }
}
