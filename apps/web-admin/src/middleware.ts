import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware. Two responsibilities, in priority order:
 *
 *   1. /api-proxy/*  → inject Authorization: Bearer from the access_token cookie
 *                       so the API receives a proper JWT. (Existing behavior;
 *                       the rewrite in next.config.ts handles the destination.)
 *
 *   2. /dashboard/*, /portal/*  → redirect unauthenticated requests to /login.
 *      /login                   → redirect already-authenticated users to their
 *                                  workspace.
 *
 * Middleware only checks cookie PRESENCE. It never verifies the JWT
 * cryptographically and never trusts the `user` cookie for authorization
 * decisions — those checks live in:
 *   * apps/web-admin/src/lib/session.ts (requireAdmin / requireBroker)
 *   * the backend guards (RolesGuard, BrokerScopeGuard, ...).
 *
 * If the access_token cookie is present but expired/invalid, the page-level
 * server fetch will 401 and the auth refresh path takes over. We deliberately
 * keep that out of the edge runtime.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── 1. /api-proxy/*  — preserve original behavior verbatim ──────────────
  if (pathname.startsWith('/api-proxy/')) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) return NextResponse.next();

    const headers = new Headers(req.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return NextResponse.next({ request: { headers } });
  }

  const hasToken = Boolean(req.cookies.get('access_token')?.value);

  // ── 2a. Already-authenticated user hitting /login → bounce to workspace ─
  if (pathname === '/login') {
    if (!hasToken) return NextResponse.next();
    return NextResponse.redirect(new URL(landingPathForUser(req), req.url));
  }

  // ── 2b. Protected app surfaces — require token presence ─────────────────
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/portal')) {
    if (hasToken) return NextResponse.next();

    // Server Action POSTs carry a `Next-Action` header. 302-redirecting them to
    // the login HTML page breaks the RSC action protocol on the client ("An
    // unexpected response was received from the server"). Let them through so
    // the action's own server-side auth (requireAdmin + backend guards) returns
    // a graceful { error } the form can display, instead of crashing.
    if (req.method === 'POST' && req.headers.has('next-action')) {
      return NextResponse.next();
    }

    const loginUrl = new URL('/login', req.url);
    // Preserve the original destination (path + query) so a later iteration
    // can honor ?from=… post-login. We URL-encode the whole thing as a single
    // value; consumers should validate it starts with '/' before redirecting.
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Best-effort routing hint based on the non-HttpOnly `user` cookie.
 * Untrusted by design — used ONLY to pick a landing page. The page itself
 * still calls requireAdmin() / requireBroker(), which do the real check.
 *
 * Per the route-protection spec: brokers go to /portal only when the cookie
 * clearly says BROKER. Anything else (missing, malformed, or any other role)
 * lands on /dashboard.
 */
function landingPathForUser(req: NextRequest): string {
  const raw = req.cookies.get('user')?.value;
  if (!raw) return '/dashboard';
  try {
    const parsed = JSON.parse(raw) as { role?: unknown };
    if (parsed && parsed.role === 'BROKER') return '/portal';
    if (parsed && parsed.role === 'MAINTENANCE_SUPERVISOR') return '/maintenance-app';
  } catch {
    // fall through
  }
  return '/dashboard';
}

export const config = {
  matcher: ['/api-proxy/:path*', '/dashboard/:path*', '/portal/:path*', '/login'],
};
