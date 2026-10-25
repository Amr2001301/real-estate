import { headers } from 'next/headers';
import { assetLinks } from '@/lib/app-links';
import { fetchBranding } from '@/lib/branding';

/**
 * Digital Asset Links for this company's domain: Android verifies it before
 * opening the site's project and unit links in the company's own app (MA4).
 * An empty list when the company has no published app with a fingerprint.
 */
export async function GET() {
  const slug = (await headers()).get('x-resolved-tenant-slug') ?? '';
  const branding = slug ? await fetchBranding(slug) : null;
  return Response.json(assetLinks(branding?.mobileApp), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
