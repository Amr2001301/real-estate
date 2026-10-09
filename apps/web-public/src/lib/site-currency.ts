import { cache } from 'react';
import { headers } from 'next/headers';
import { fetchBranding } from './branding';

/** Used when the branding cannot be loaded. */
export const DEFAULT_CURRENCY = 'EGP';

/**
 * The company's currency for server components (Company.currency, from the
 * public branding of the tenant this request resolved to). Client components
 * read the same value through components/currency's useCurrency().
 */
export const getSiteCurrency = cache(async (): Promise<string> => {
  const slug = (await headers()).get('x-resolved-tenant-slug') ?? '';
  const branding = slug ? await fetchBranding(slug) : null;
  return branding?.currency ?? DEFAULT_CURRENCY;
});
