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
  /**
   * Optional short machine code surfaced from a safe error body (e.g.
   * `email_taken`). Only a plain string `code` field is read — never the raw
   * message/body — so this can't leak backend internals to the UI.
   */
  code?: string;
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

/** Read a short, safe `code` string from an error response body (if any). */
async function readSafeCode(res: Response): Promise<{ code?: string }> {
  try {
    const body = (await res.clone().json()) as { code?: unknown };
    if (typeof body?.code === 'string' && body.code.length <= 40) return { code: body.code };
  } catch {
    /* not JSON / no code — ignore */
  }
  return {};
}

export async function safeFetch<T>(
  path: string,
  init?: RequestInit & { revalidate?: number; tenantSlug?: string },
): Promise<ApiResult<T>> {
  const { revalidate, tenantSlug, ...rest } = init ?? {};
  const url = resolveUrl(path);
  const baseHeaders: Record<string, string> = { Accept: 'application/json' };
  if (tenantSlug) baseHeaders['x-tenant-slug'] = tenantSlug;
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { ...baseHeaders, ...(rest.headers as Record<string, string> | undefined ?? {}) },
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    });

    if (!res.ok) {
      logDev(`${rest.method ?? 'GET'} ${path} → HTTP ${res.status} ${res.statusText}`);
      return {
        ok: false,
        error: {
          message: friendlyForStatus(res.status),
          status: res.status,
          ...(await readSafeCode(res)),
        },
      };
    }

    const text = await res.text();
    if (!text) {
      logDev(`${path} → empty response body (HTTP ${res.status})`);
      return { ok: false, error: { message: FRIENDLY.load, status: res.status } };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      logDev(`${path} → invalid JSON (first 120 chars):`, text.slice(0, 120));
      return { ok: false, error: { message: FRIENDLY.load, status: res.status } };
    }
  } catch (err) {
    // Network-level failure (no HTTP response). Surface an actionable hint in dev.
    const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (err as { code?: string })?.code;
    if (code === 'ECONNREFUSED') {
      logDev(`${path} → connection refused at ${url} — is the API running? (pnpm --filter @rep/api dev)`);
    } else {
      logDev(`${path} → network error at ${url}`, code ?? err);
    }
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
