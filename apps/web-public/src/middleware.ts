import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware for the public website. Two responsibilities:
 *
 *   1. /api-proxy/*  → inject `Authorization: Bearer` from the access_token
 *      cookie so authenticated client-side calls reach the API as proper JWTs.
 *
 *   2. /account/*  → redirect unauthenticated visitors to /login.
 *      /login and /register → bounce already-authenticated users to /account.
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
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: r.expiresIn,
  });
  response.cookies.set('refresh_token', r.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  response.cookies.set(
    'user',
    JSON.stringify({ id: r.user.id, role: r.user.role, fullName: r.user.fullName }),
    {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: THIRTY_DAYS,
    },
  );
}

export async function middleware(req: NextRequest) {
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

export const config = {
  matcher: ['/api-proxy/:path*', '/account/:path*', '/login', '/register'],
};
