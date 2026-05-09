import { cookies } from 'next/headers';

export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  noAuth?: boolean;
  body?: unknown;
  /** When true, send Accept-Language for translatable flattening; otherwise raw {ar,en}. */
  flatten?: boolean;
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { noAuth, headers, body, flatten, ...init } = opts;
  const c = await cookies();
  const token = c.get('access_token')?.value;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
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

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `API ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
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

/** Fetch with bearer auth and return json — for server actions/components calling our API directly. */
export async function apiCall<T>(path: string, init?: RequestInit & { body?: unknown }): Promise<T> {
  const method = (init?.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE') ?? 'GET';
  if (method === 'GET') return api.get<T>(path);
  if (method === 'POST') return api.post<T>(path, init?.body);
  if (method === 'PATCH') return api.patch<T>(path, init?.body);
  if (method === 'PUT') return api.put<T>(path, init?.body);
  return api.delete<T>(path);
}

/** A safe wrapper that returns either { data } or { error } — useful for server components. */
export async function safe<T>(promise: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await promise, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}
