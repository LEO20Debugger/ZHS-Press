import { NextResponse, type NextRequest } from 'next/server';

/**
 * Gates the admin area and keeps it out of search results.
 *
 * This is a convenience redirect, not the security boundary — it only checks
 * that a session cookie is *present*, because middleware runs on the edge and
 * has no way to verify the signature or check the user is still enabled. The
 * real check is AdminGuard on the API, which verifies the JWT on every single
 * request. Anyone forging a cookie value gets past this redirect and straight
 * into a 401 from the API with no data.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const hasSession = request.cookies.has('zhs_admin');

    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      // Come back to where they were headed once signed in.
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();

  if (pathname.startsWith('/admin')) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
