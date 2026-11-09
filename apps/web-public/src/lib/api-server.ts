import { safeFetch, type ApiResult } from '@/lib/api';
import { getLocale } from '@/lib/locale';

/**
 * `safeFetch` for server components: asks the API for the visitor's language.
 * The API flattens its translatable fields (project and unit names, descriptions,
 * unit types…) from `Accept-Language`; without it the English site showed the
 * Arabic text of every record (QA run 2, public-site sweep).
 *
 * A caller that sets its own `Accept-Language` keeps it. Outside a request
 * (no cookies to read) the call goes out as before.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { revalidate?: number; tenantSlug?: string },
): Promise<ApiResult<T>> {
  const own = (init?.headers as Record<string, string> | undefined) ?? {};
  if (Object.keys(own).some((k) => k.toLowerCase() === 'accept-language')) return safeFetch<T>(path, init);
  let language: string | undefined;
  try {
    language = await getLocale();
  } catch {
    language = undefined;
  }
  return safeFetch<T>(path, language ? { ...init, headers: { ...own, 'Accept-Language': language } } : init);
}
