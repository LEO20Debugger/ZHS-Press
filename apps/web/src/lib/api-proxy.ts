import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Forwards a capture form to the API from the server side.
 *
 * The browser posts to the Next app's own origin rather than straight to the
 * API, which keeps the API host out of the client bundle and avoids a CORS
 * preflight on every signup.
 *
 * Errors are deliberately flattened: the caller learns whether it worked, not
 * which internal service was unreachable.
 */
export async function forwardToApi(path: string, body: unknown): Promise<NextResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      return NextResponse.json(
        { ok: false, errors: detail?.errors ?? null },
        { status: response.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
