import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware for the public website. Three responsibilities:
 *
 *   1. Tenant resolution — map the request hostname to a tenant slug by calling
 *      the backend /v1/public/domains/resolve endpoint. The result is forwarded
 *      to server components via x-resolved-tenant-slug and
 *      x-resolved-tenant-website-enabled request headers.
 *      Dev override: DEV_TENANT_SLUG env var bypasses the network call when running
 *      on localhost so the app works without a configured platform domain.
 *
 *   2. /api-proxy/* → inject Bearer from cookie AND X-Tenant-Slug from the
 *      resolved tenant so authenticated and unauthenticated client-side API calls
 *      reach the backend with the correct tenant context.
 *
 *   3. /account/* → redirect unauthenticated visitors to /login.
 *      /login and /register → bounce already-authenticated users to /account.
 *      Silent token refresh via /v1/auth/refresh when access_token is absent
 *      but refresh_token is present.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';
// DEV_TENANT_SLUG is NEVER active in production regardless of env var presence.
// NODE_ENV gate is explicit so the guarantee is auditable in source.
const DEV_TENANT_SLUG =
  process.env.NODE_ENV !== 'production' ? process.env.DEV_TENANT_SLUG : undefined;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Hostnames that indicate a local development environment.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

interface ResolvedTenant {
  slug: string;
  websiteEnabled: boolean;
}

/**
 * Resolve a hostname to a tenant.
 *
 * Returns null when the hostname is not registered as a company domain (e.g.
 * the platform's own base domain), when the company's website is suspended,
 * or when the backend is unreachable.
 */
async function resolveTenant(hostname: string): Promise<ResolvedTenant | null> {
  // Dev fallback: skip the network call on localhost when DEV_TENANT_SLUG is set.
  if (DEV_TENANT_SLUG && LOCAL_HOSTS.has(hostname)) {
    return { slug: DEV_TENANT_SLUG, websiteEnabled: true };
  }

  try {
    const url = `${API_BASE}/v1/public/domains/resolve?hostname=${encodeURIComponent(hostname)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Backend Redis cache handles deduplication; do not let Next.js cache this.
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string; websiteEnabled?: boolean } | null;
    if (!data?.slug) return null;
    return { slug: data.slug, websiteEnabled: Boolean(data.websiteEnabled) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auth helpers (unchanged from prior implementation)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hostname = req.nextUrl.hostname;

  // Resolve tenant once per request — used by all branches below.
  const tenant = await resolveTenant(hostname);

  // ── 1. /api-proxy/* — attach Bearer and X-Tenant-Slug ──────────────────────
  if (pathname.startsWith('/api-proxy/')) {
    const headers = new Headers(req.headers);

    // Strip internal routing headers — the browser must never supply these.
    // They carry server-computed values that the middleware writes on page
    // requests; forwarding them to the backend would be a no-op at best and
    // a spoofing vector at worst if the backend ever added a reader.
    headers.delete('x-resolved-tenant-slug');
    headers.delete('x-resolved-tenant-website-enabled');

    const token = req.cookies.get('access_token')?.value;
    if (token) headers.set('Authorization', `Bearer ${token}`);

    // Always overwrite (or explicitly delete) the X-Tenant-Slug header.
    // NEVER forward the browser-supplied value: the authoritative slug comes
    // from the server-resolved tenant only. If resolution failed (unknown host),
    // delete any header the browser may have sent.
    if (tenant?.slug) {
      headers.set('x-tenant-slug', tenant.slug);
    } else {
      headers.delete('x-tenant-slug');
    }

    return NextResponse.next({ request: { headers } });
  }

  // ── 2. Build forwarded request headers with resolved tenant context ─────────
  // Server components read x-resolved-tenant-slug via next/headers to determine
  // which tenant's data to fetch. Absent or empty slug → notFound().
  //
  // Security: headers.set() REPLACES any existing value — including spoofed
  // values sent by the browser. An attacker sending x-resolved-tenant-slug:X
  // always gets it overwritten with the server-computed value here.
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.set('x-resolved-tenant-slug', tenant?.slug ?? '');
  forwardHeaders.set('x-resolved-tenant-website-enabled', String(tenant?.websiteEnabled ?? false));

  const hasToken = Boolean(req.cookies.get('access_token')?.value);

  // ── 3a. Authenticated user hitting /login or /register → go to /account ─────
  if (pathname === '/login' || pathname === '/register') {
    if (!hasToken) return NextResponse.next({ request: { headers: forwardHeaders } });
    return NextResponse.redirect(new URL('/account', req.url));
  }

  // ── 3b. Protected portal — require token presence ───────────────────────────
  if (pathname.startsWith('/account')) {
    if (hasToken) return NextResponse.next({ request: { headers: forwardHeaders } });

    const refreshed = await tryRefresh(req);
    if (refreshed.success) {
      const response = NextResponse.next({ request: { headers: forwardHeaders } });
      applyRefreshCookies(response, refreshed, req);
      return response;
    }

    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({ request: { headers: forwardHeaders } });

  // Defense-in-depth: if a CDN ignores Cache-Control: no-store (set by Next.js
  // for all dynamic routes), Vary: Host ensures cached entries are keyed per
  // hostname and can never serve one tenant's page to another.
  response.headers.set('Vary', 'Host');

  return response;
}

export const config = {
  // Run on all routes except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
