/**
 * Public API access for the marketing website.
 *
 * `safeFetch` is the single funnel for every public request. It NEVER throws on
 * an API error and NEVER returns raw backend payloads on failure — callers get
 * a discriminated result with a friendly Arabic message, so no stack trace or
 * JSON error body can ever reach the UI. Technical detail is logged only in
 * development.
 */

export const FRIENDLY = {
  load: 'تعذر تحميل البيانات حاليًا.',
  retry: 'يرجى المحاولة مرة أخرى بعد لحظات.',
  notFound: 'لم نتمكن من العثور على ما تبحث عنه.',
  unexpected: 'حدث خطأ غير متوقع، لكن تجربتك ما زالت آمنة.',
} as const;

export interface ApiError {
  message: string;
  status: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

const isServer = typeof window === 'undefined';

/** Resolve a `/public/...` path to a fetchable URL on both server and client. */
function resolveUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (isServer) {
    const base = process.env.API_BASE_URL ?? 'http://localhost:4000';
    return `${base}/v1${clean}`;
  }
  // In the browser the Next rewrite proxies /api-proxy → API /v1.
  return `/api-proxy${clean}`;
}

function friendlyForStatus(status: number): string {
  if (status === 404) return FRIENDLY.notFound;
  if (status >= 500) return FRIENDLY.load;
  return FRIENDLY.unexpected;
}

function logDev(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[public-api]', ...args);
  }
}

export async function safeFetch<T>(
  path: string,
  init?: RequestInit & { revalidate?: number },
): Promise<ApiResult<T>> {
  const { revalidate, ...rest } = init ?? {};
  try {
    const res = await fetch(resolveUrl(path), {
      ...rest,
      headers: { Accept: 'application/json', ...(rest.headers ?? {}) },
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    });

    if (!res.ok) {
      logDev(`${rest.method ?? 'GET'} ${path} → ${res.status}`);
      return { ok: false, error: { message: friendlyForStatus(res.status), status: res.status } };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    logDev(`${path} threw`, err);
    return { ok: false, error: { message: FRIENDLY.load, status: 0 } };
  }
}

/** POST a public form payload (info/visit request). Same safe contract. */
export function safePost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return safeFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
