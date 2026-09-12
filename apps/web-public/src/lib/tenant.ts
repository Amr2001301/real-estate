import { headers } from 'next/headers';

export interface ResolvedTenant {
  slug: string;
  websiteEnabled: boolean;
}

/**
 * Read the tenant resolved by the edge middleware for this request.
 *
 * Returns the tenant when the request hostname maps to an ACTIVE company
 * whose website is enabled, or null in all other cases (platform base domain,
 * unknown host, suspended/archived company, website disabled).
 *
 * Usage in server components:
 *   const tenant = await getResolvedTenant();
 *   if (!tenant) notFound();
 */
export async function getResolvedTenant(): Promise<ResolvedTenant | null> {
  const h = await headers();
  const slug = h.get('x-resolved-tenant-slug');
  const websiteEnabledRaw = h.get('x-resolved-tenant-website-enabled');

  if (!slug) return null;

  const websiteEnabled = websiteEnabledRaw === 'true';
  if (!websiteEnabled) return null;

  return { slug, websiteEnabled };
}
