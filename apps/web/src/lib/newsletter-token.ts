import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Runs a token-bearing newsletter action against the API.
 *
 * Exposed to the browser as POST, even though the API endpoint is a GET.
 *
 * That is not pedantry about HTTP verbs — it is the only thing standing between
 * double opt-in and a scanner. Links in email are fetched by things that are
 * not the recipient: spam filters follow them, corporate gateways rewrite and
 * probe them, and clients prefetch them to render a preview. A confirmation
 * link that takes effect on GET is therefore confirmed by the first machine to
 * look at it, which defeats the entire purpose of asking the human to confirm.
 * The unsubscribe link has the mirror problem: a prefetch would remove someone
 * from a list they never asked to leave.
 *
 * So the emailed link opens a page, and the page asks for a click. The token
 * travels no further than this server, which then talks to the API itself.
 */
export async function runTokenAction(
  action: 'confirm' | 'unsubscribe',
  token: string,
): Promise<NextResponse> {
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'missing_token' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/newsletter/${action}?token=${encodeURIComponent(token)}`,
      { method: 'GET', cache: 'no-store' },
    );

    if (!response.ok) {
      // 404 from the API means the token is spent or was never real. Both are
      // "this link no longer works" to the person reading it.
      return NextResponse.json(
        { ok: false, reason: response.status === 404 ? 'invalid_token' : 'error' },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unreachable' }, { status: 502 });
  }
}
