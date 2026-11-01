import { safeFetch } from '@/lib/api';
import type { Locale } from '@/lib/locale';

/** A company page as the site lists it (footer, sitemap). */
export interface PublicPageLink {
  slug: string;
  title: string;
  updatedAt: string;
}

export interface PublicPage extends PublicPageLink {
  body: string;
}

/** An active banner of the company, in its order. */
export interface PublicBanner {
  id: string;
  imageUrl: string;
  title: string;
  link: string | null;
}

// Content changes rarely; a minute keeps an edit quick to appear.
const REVALIDATE = 60;

const opts = (tenantSlug: string, locale: Locale) => ({
  revalidate: REVALIDATE,
  tenantSlug,
  headers: { 'Accept-Language': locale },
});

export async function fetchPageLinks(tenantSlug: string, locale: Locale): Promise<PublicPageLink[]> {
  const res = await safeFetch<PublicPageLink[]>('/public/pages', opts(tenantSlug, locale));
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

export async function fetchPage(tenantSlug: string, slug: string, locale: Locale) {
  return safeFetch<PublicPage>(`/public/pages/${encodeURIComponent(slug)}`, opts(tenantSlug, locale));
}

export async function fetchBanners(tenantSlug: string, locale: Locale): Promise<PublicBanner[]> {
  const res = await safeFetch<PublicBanner[]>('/public/banners', opts(tenantSlug, locale));
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

/** A banner link is a site path or a web address (the API refuses anything else). */
export function isExternalLink(link: string): boolean {
  return /^https?:\/\//i.test(link);
}
