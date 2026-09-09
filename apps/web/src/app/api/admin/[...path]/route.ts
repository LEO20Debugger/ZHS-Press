import { NextResponse, type NextRequest } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

/**
 * Catch-all proxy for the admin API.
 *
 * The browser talks only to its own origin; this forwards the httpOnly auth
 * cookies to the API and passes any Set-Cookie back. Keeping it server-side
 * means the admin JWT is never readable by client-side JavaScript, and the API
 * host never appears in the bundle.
 */
async function proxy(request: NextRequest, path: string[]) {
  const target = `${API_BASE_URL}/api/${path.join('/')}${request.nextUrl.search}`;

  /*
   * arrayBuffer(), never text().
   *
   * text() decodes the body as UTF-8. For JSON that is harmless; for a
   * multipart file upload it is destructive — every byte sequence that is not
   * valid UTF-8 becomes U+FFFD, so the image arrives corrupted and is rejected
   * as "not an image we can read". arrayBuffer preserves the bytes exactly and
   * works for both.
   */
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        // Forward the session cookies verbatim; the API is the thing that
        // validates them.
        cookie: request.headers.get('cookie') ?? '',
      },
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    // The API is unreachable. 502 says so honestly — a 500 here would look
    // like a bug in this app, and a 401 would wrongly suggest the session
    // was rejected.
    return NextResponse.json(
      { message: 'The admin service is unavailable.' },
      { status: 502 },
    );
  }

  const contentType = response.headers.get('content-type') ?? 'application/json';

  // CSV export and other non-JSON responses pass through untouched.
  const payload = contentType.includes('application/json')
    ? JSON.stringify(await response.json().catch(() => null))
    : await response.text();

  const result = new NextResponse(payload, {
    status: response.status,
    headers: {
      'content-type': contentType,
      ...(response.headers.get('content-disposition')
        ? { 'content-disposition': response.headers.get('content-disposition') as string }
        : {}),
    },
  });

  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    result.headers.append('set-cookie', cookie);
  }

  return result;
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
