import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { formatMissingPermissionMessage } from './permission-error';

export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  /** Stable code surfaced by the API (e.g. 'missing_permission'). */
  public code?: string;
  /** Permission codes the user is missing, when `code === 'missing_permission'`. */
  public permissions?: string[];

  /** The original API message (e.g. "Missing permission: contracts:sign"),
   *  kept for logging/debugging. `.message` is overridden below for known
   *  403 shapes so user-facing reads get Arabic text automatically. */
  public rawMessage: string;

  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.rawMessage = message;
    if (payload && typeof payload === 'object') {
      const p = payload as { code?: unknown; permissions?: unknown };
      if (typeof p.code === 'string') this.code = p.code;
      if (Array.isArray(p.permissions)) {
        this.permissions = p.permissions.filter(
          (c): c is string => typeof c === 'string',
        );
      }
    }
    // Central substitution: server actions and any other caller that just
    // reads `.message` automatically gets a friendly Arabic string for the
    // two 403 shapes the API emits — no per-action rewriting needed.
    if (this.code === 'missing_permission') {
      this.message = formatMissingPermissionMessage(this);
    } else if (this.status === 403) {
      this.message = 'ليست لديك صلاحية الوصول إلى هذا المورد.';
    }
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  noAuth?: boolean;
  body?: unknown;
  /** When true, send Accept-Language for translatable flattening; otherwise raw {ar,en}. */
  flatten?: boolean;
}

/**
 * Exchange the stored refresh_token for a fresh access_token + refresh_token.
 * Returns true on success. MUST be called from a Server Action or Route
 * Handler — Next.js does not allow cookie writes during a render, so we swallow
 * write failures and let the caller decide (e.g. redirect to /login).
 */
async function refreshAdminSession(): Promise<boolean> {
  const c = await cookies();
  const refreshToken = c.get('refresh_token')?.value;
  if (!refreshToken) return false;

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
  if (!res.ok) return false;

  let data: {
    user: { id: string; role: string; fullName: string };
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  };
  try {
    data = await res.json() as typeof data;
  } catch {
    return false;
  }

  try {
    const secure = process.env.NODE_ENV === 'production';
    c.set('access_token', data.tokens.accessToken, {
      httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: data.tokens.expiresIn,
    });
    c.set('refresh_token', data.tokens.refreshToken, {
      httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    c.set('user', JSON.stringify({ id: data.user.id, role: data.user.role, fullName: data.user.fullName }), {
      httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
    return true;
  } catch {
    // render context — cookie write not allowed; caller will redirect to /login
    return false;
  }
}

async function doFetch(path: string, token: string | undefined, opts: ApiOptions): Promise<Response> {
  const { noAuth, headers, body, flatten, ...init } = opts;
  try {
    return await fetch(`${API_BASE}/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(noAuth || !token ? {} : { Authorization: `Bearer ${token}` }),
        ...(flatten ? {} : { 'X-Raw-Translatable': '1' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new ApiError(0, `لا يمكن الوصول إلى الـ API على ${API_BASE} — تأكد أنه يعمل`);
    }
    throw new ApiError(0, msg || 'Network error');
  }
}

function parseResponse<T>(res: Response, payload: unknown): T {
  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `API ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

async function readPayload(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const c = await cookies();
  const token = c.get('access_token')?.value;

  const first = await doFetch(path, token, opts);
  if (first.status !== 401) {
    const payload = await readPayload(first);
    if (first.status === 204) return undefined as T;
    return parseResponse<T>(first, payload);
  }

  // 401 — attempt a single token refresh then retry.
  const refreshed = await refreshAdminSession();
  if (!refreshed) redirect('/login');

  const newToken = (await cookies()).get('access_token')?.value;
  const second = await doFetch(path, newToken, opts);
  if (second.status === 401) redirect('/login');

  const payload2 = await readPayload(second);
  if (second.status === 204) return undefined as T;
  return parseResponse<T>(second, payload2);
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: ApiOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as {
    user: { id: string; role: string; fullName: string };
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  };
}

type AuthResult = {
  user: { id: string; role: string; fullName: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
};

// MT-026 — Tenant-aware staff login. Called from the staff login form.
// The slug is resolved server-side by the backend; companyId never comes from the client.
export async function loginStaff(slug: string, email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/v1/auth/login-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, email, password }),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as AuthResult;
}

// MT-027 — Platform super-admin login. No company field — SUPER_ADMIN has companyId=null.
export async function loginSuperAdmin(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/v1/auth/login-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as AuthResult;
}

/** Fetch with bearer auth and return json — for server actions/components calling our API directly. */
export async function apiCall<T>(path: string, init?: RequestInit & { body?: unknown }): Promise<T> {
  const method = (init?.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') ?? 'GET';
  if (method === 'GET') return api.get<T>(path);
  if (method === 'POST') return api.post<T>(path, init?.body);
  if (method === 'PATCH') return api.patch<T>(path, init?.body);
  if (method === 'PUT') return api.put<T>(path, init?.body);
  return api.delete<T>(path);
}

export interface SafeError {
  /** Localised, user-friendly Arabic message — already substituted for
   *  missing_permission / generic 403, so existing read sites that just
   *  render `.error` keep working without changes. */
  error: string;
  /** HTTP status, when the underlying failure was an ApiError. */
  status?: number;
  /** Stable API code (e.g. 'missing_permission'). */
  code?: string;
  /** Permission codes the user is missing, when applicable. */
  permissions?: string[];
}

/**
 * A safe wrapper that returns either { data } or { error } — useful for
 * server components. Extends the legacy two-field shape with optional
 * `status` / `code` / `permissions` so callers that care can render a
 * precise empty-state without re-fetching, while existing callers that
 * only read `.error` continue to work.
 */
export async function safe<T>(
  promise: Promise<T>,
): Promise<{ data: T; error: null } | ({ data: null } & SafeError)> {
  try {
    return { data: await promise, error: null };
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        data: null,
        error: formatMissingPermissionMessage(e),
        status: e.status,
        code: e.code,
        permissions: e.permissions,
      };
    }
    return { data: null, error: (e as Error).message ?? 'حدث خطأ غير متوقع.' };
  }
}
