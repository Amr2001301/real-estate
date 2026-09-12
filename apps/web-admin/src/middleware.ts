import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware. Three responsibilities, in priority order:
 *
 *   1. /api-proxy/*          → inject Authorization: Bearer from the access_token cookie.
 *
 *   2. /dashboard/*, /portal/* → redirect unauthenticated requests to /login.
 *      /login                   → redirect already-authenticated users to their workspace.
 *
 *   3. /super-admin/login    → platform-admin login page:
 *      - unauthenticated     → serve the page
 *      - authenticated SUPER_ADMIN → redirect to /dashboard/super-admin
 *      - authenticated other       → redirect to their workspace (not this page)
 *
 * Transparent token refresh: when access_token is missing but refresh_token is
 * present, the middleware calls POST /v1/auth/refresh, sets new cookies on the
 * response, and continues the navigation — the user never sees the login page.
 */

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

interface RefreshResult {
  success: false;
}
interface RefreshSuccess {
  success: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; role: string; fullName: string };
}

async function tryRefresh(req: NextRequest): Promise<RefreshResult | RefreshSuccess> {
  const raw = req.cookies.get('refresh_token')?.value;
  if (!raw) return { success: false };
  try {
    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: raw }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { success: false };
    const data = (await res.json()) as {
      user: { id: string; role: string; fullName: string };
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    };
    return {
      success: true,
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
      expiresIn: data.tokens.expiresIn,
      user: data.user,
    };
  } catch {
    return { success: false };
  }
}

function applyRefreshCookies(response: NextResponse, r: RefreshSuccess, req: NextRequest) {
  const secure = req.nextUrl.protocol === 'https:';
  response.cookies.set('access_token', r.accessToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: r.expiresIn,
  });
  response.cookies.set('refresh_token', r.refreshToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: THIRTY_DAYS,
  });
  response.cookies.set('user', JSON.stringify({ id: r.user.id, role: r.user.role, fullName: r.user.fullName }), {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: THIRTY_DAYS,
  });
}

/** Derive the role from the non-httpOnly `user` cookie. Returns null if unparseable. */
function roleFromCookies(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('user')?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
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

  // ── 2. /super-admin/login ────────────────────────────────────────────────
  // Unauthenticated: serve the page.
  // Authenticated SUPER_ADMIN: already logged in → bounce to their workspace.
  // Authenticated other role: wrong page → bounce to their workspace.
  if (pathname === '/super-admin/login') {
    if (!hasToken) return NextResponse.next();
    return NextResponse.redirect(new URL(landingPathForUser(req), req.url));
  }

  // ── 3a. Already-authenticated user hitting /login → bounce to workspace ──
  if (pathname === '/login') {
    if (!hasToken) return NextResponse.next();
    return NextResponse.redirect(new URL(landingPathForUser(req), req.url));
  }

  // ── 3b. Protected app surfaces — require token presence ──────────────────
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/portal')) {
    if (hasToken) return NextResponse.next();

    // Server Action POSTs carry a `Next-Action` header — don't redirect them.
    if (req.method === 'POST' && req.headers.has('next-action')) {
      return NextResponse.next();
    }

    // access_token gone but refresh_token may still be valid → try silent refresh.
    const refreshed = await tryRefresh(req);
    if (refreshed.success) {
      const response = NextResponse.next();
      applyRefreshCookies(response, refreshed, req);
      return response;
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

function landingPathForUser(req: NextRequest): string {
  const role = roleFromCookies(req);
  if (role === 'SUPER_ADMIN') return '/dashboard/super-admin';
  if (role === 'BROKER') return '/portal';
  if (role === 'MAINTENANCE_SUPERVISOR') return '/maintenance-app';
  return '/dashboard';
}

export const config = {
  matcher: [
    '/api-proxy/:path*',
    '/dashboard/:path*',
    '/portal/:path*',
    '/login',
    '/super-admin/login',
  ],
};
