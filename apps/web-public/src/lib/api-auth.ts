/**
 * Authenticated SERVER-SIDE API access for the /account portal.
 *
 * This is for future authenticated pages/actions only — it is NOT a replacement
 * for the public `safeFetch`/`safePost` in lib/api.ts, and it does NOT proxy
 * (client-side authed calls keep using /api-proxy/* + the middleware Bearer
 * injection + the next.config rewrite — see middleware.ts).
 *
 * Refresh contract:
 *   * refreshSession() reads the httpOnly refresh_token, calls POST /v1/auth/refresh,
 *     and on success replaces all three cookies; on failure clears them.
 *   * authFetch() attaches the Bearer token; on a 401 it refreshes once and
 *     retries once; if that fails it clears cookies and throws AuthError.
 *
 * RUNTIME CONSTRAINT: cookies can only be written inside a Server Action or
 * Route Handler — never during a server-component render. So the refresh path
 * is only effective when authFetch/refreshSession run in those contexts. When
 * authFetch is called during a render and the token is already expired, the
 * cookie write will fail; we catch that and surface AuthError so the page can
 * redirect to /login. Refresh is deliberately kept OUT of edge middleware.
 */
import { cookies } from 'next/headers';
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
    return false; // network failure — don't clear; the token may still be valid
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
    // Render-context cookie write is not allowed — can't persist the new
    // session here. Treat as not-refreshed; caller surfaces AuthError → /login.
    return false;
  }
}

/**
 * Authenticated server-side fetch against the backend `/v1` API.
 * Attaches Bearer from the access_token cookie; refreshes + retries once on 401.
 * Throws AuthError when unauthenticated; throws a generic Error on other non-2xx.
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
  const c = await cookies();
  const token = c.get('access_token')?.value;
  // For multipart bodies (file uploads) we must NOT set Content-Type — fetch
  // derives it with the correct multipart boundary. Everything else is JSON.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  return fetch(`${API_BASE}/v1${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) throw new AuthError();
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
