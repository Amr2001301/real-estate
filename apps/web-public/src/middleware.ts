import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware for the public website. Two responsibilities:
 *
 *   1. /api-proxy/*  → inject `Authorization: Bearer` from the access_token
 *      cookie so authenticated client-side calls reach the API as proper JWTs.
 *      The actual proxying to the backend is done by the rewrite in
 *      next.config.ts (/api-proxy/:path* → ${API_BASE_URL}/v1/:path*). This
 *      middleware only adds the header; it does not itself proxy.
 *
 *   2. /account/*  → redirect unauthenticated visitors to /login (preserving
 *      the original destination in ?from=). /login and /register → bounce
 *      already-authenticated users to /account.
 *
 * Middleware checks cookie PRESENCE only. It never verifies the JWT and never
 * trusts the `user` cookie for authorization. Real checks live in:
 *   * apps/web-public/src/lib/session.ts (getSession / role checks at layout level)
 *   * the backend guards (RolesGuard, ...).
 *
 * If the access_token is present but expired, the page-level server fetch will
 * 401 and the refresh path (added in a later step) takes over. We deliberately
 * keep refresh out of the edge runtime.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── 1. /api-proxy/* — attach Bearer from cookie (rewrite handles routing) ──
  if (pathname.startsWith('/api-proxy/')) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) return NextResponse.next();

    const headers = new Headers(req.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return NextResponse.next({ request: { headers } });
  }

  const hasToken = Boolean(req.cookies.get('access_token')?.value);

  // ── 2a. Authenticated user hitting /login or /register → go to /account ────
  if (pathname === '/login' || pathname === '/register') {
    if (!hasToken) return NextResponse.next();
    return NextResponse.redirect(new URL('/account', req.url));
  }

  // ── 2b. Protected portal — require token presence ──────────────────────────
  if (pathname.startsWith('/account')) {
    if (hasToken) return NextResponse.next();

    const loginUrl = new URL('/login', req.url);
    // Preserve original destination (path + query) so login can honor ?from=.
    // Consumers MUST validate it starts with '/account' before redirecting.
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api-proxy/:path*', '/account/:path*', '/login', '/register'],
};
