/**
 * Authenticated SERVER-SIDE API access for the /account portal.
 *
 * F2 — MT-052: authFetch now reads x-resolved-tenant-slug from the F1 middleware
 * header and forwards it as X-Tenant-Slug on every backend call. This enables
 * the MT-031 tenant/user mismatch check server-side.
 *
 * 403 handling (narrowed in F2):
 *   - 403 + body.code === 'TENANT_CONTEXT_MISMATCH' → safeClear() + AuthError.
 *     This prevents an infinite loop between /account and /login when the
 *     authenticated user's companyId doesn't match the requested tenant.
 *   - 403 + any other code (business rule, capability, ownership) → ForbiddenError.
 *     Session cookies are NOT touched. Callers handle the error without logout.
 *
 * Refresh contract:
 *   refreshSession() reads the httpOnly refresh_token, calls POST /v1/auth/refresh,
 *   and on success replaces all three cookies; on failure clears them.
 *   authFetch() attaches the Bearer token; on a 401 it refreshes once and
 *   retries once; if that fails it clears cookies and throws AuthError.
 *
 * RUNTIME CONSTRAINT: cookies can only be written inside a Server Action or
 * Route Handler — never during a server-component render. When authFetch is
 * called during a render and the token is already expired, the cookie write
 * will fail; we catch that and surface AuthError so the page can redirect to
 * /login. Refresh is deliberately kept OUT of edge middleware.
 */
import { cookies, headers } from 'next/headers';
import { setSessionCookies, clearSessionCookies, type AuthSession } from '@/lib/auth-cookies';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

/** Thrown when the session cannot be established/refreshed. Callers should redirect to /login. */
export class AuthError extends Error {
  constructor(message = 'unauthenticated') {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Thrown for business-rule 403s (capability gating, ownership, etc.).
 * Session cookies are NOT cleared — the user remains authenticated.
 * Only 403 + code TENANT_CONTEXT_MISMATCH produces AuthError instead.
 */
export class ForbiddenError extends Error {
  constructor(public readonly code?: string) {
    super('forbidden');
    this.name = 'ForbiddenError';
  }
}

/**
 * Exchange the refresh_token for a new session. Returns true on success.
 * MUST be called from a Server Action or Route Handler (it writes cookies).
 */
export async function refreshSession(): Promise<boolean> {
  const c = await cookies();
  const refreshToken = c.get('refresh_token')?.value;
  if (!refreshToken) {
    await safeClear();
    return false;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return false;
  }

  if (!res.ok) {
    await safeClear();
    return false;
  }

  let data: AuthSession;
  try {
    data = (await res.json()) as AuthSession;
  } catch {
    await safeClear();
    return false;
  }

  try {
    await setSessionCookies(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticated server-side fetch against the backend `/v1` API.
 * Attaches Bearer from the access_token cookie; refreshes + retries once on 401.
 * Forwards X-Tenant-Slug from the F1-resolved header for MT-031 defense-in-depth.
 * Throws AuthError when unauthenticated or on tenant mismatch (403 TENANT_CONTEXT_MISMATCH).
 * Throws ForbiddenError for other 403s (session preserved, no cookie clear).
 * Throws a generic Error on other non-2xx responses.
 */
export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const clean = path.startsWith('/') ? path : `/${path}`;

  const first = await doFetch(clean, init);
  if (first.status !== 401) return handle<T>(first);

  // 401 → try a single refresh + retry.
  const refreshed = await refreshSession();
  if (!refreshed) throw new AuthError();

  const second = await doFetch(clean, init);
  if (second.status === 401) {
    await safeClear();
    throw new AuthError();
  }
  return handle<T>(second);
}

async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  const token = c.get('access_token')?.value;
  const tenantSlug = h.get('x-resolved-tenant-slug');
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  return fetch(`${API_BASE}/v1${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new AuthError();
  if (res.status === 403) {
    // Read the machine-readable code from the response body.
    // Only TENANT_CONTEXT_MISMATCH clears the session — all other 403s are
    // business-rule forbidden and must NOT log the customer out.
    let code: string | undefined;
    try {
      const body = (await res.clone().json()) as { code?: unknown };
      if (typeof body?.code === 'string') code = body.code;
    } catch {
      /* non-JSON body — treat as ordinary forbidden */
    }
    if (code === 'TENANT_CONTEXT_MISMATCH') {
      await safeClear();
      throw new AuthError();
    }
    throw new ForbiddenError(code);
  }
  if (!res.ok) throw new Error(`API ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Clear cookies, swallowing the render-context "cannot set cookies" error. */
async function safeClear(): Promise<void> {
  try {
    await clearSessionCookies();
  } catch {
    /* called during render — caller will redirect to /login on AuthError */
  }
}
