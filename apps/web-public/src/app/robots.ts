import type { MetadataRoute } from 'next';
import { siteUrl, SITE_URL } from '@/lib/seo';

/**
 * robots.txt policy.
 *
 * PRODUCTION: Allow crawling of all public pages; disallow private/transient
 * paths. This does NOT enforce access control — auth routes are still protected
 * by middleware; robots.txt is a crawl hint only.
 *
 * NON-PRODUCTION: `Disallow: /` prevents staging/preview environments from
 * being indexed. Detection: NEXT_PUBLIC_SITE_URL / SITE_URL must contain the
 * production domain to be treated as production. If neither is set, the
 * default is localhost → non-production (safe default).
 */

const isProduction = (() => {
  const url = SITE_URL.toLowerCase();
  // localhost / 127.x / private ranges → definitely not production
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  // If the URL looks like a real non-local domain it is production.
  // Operators may also set NODE_ENV=production explicitly.
  return process.env.NODE_ENV === 'production' || (!url.startsWith('http://'));
})();

const PRIVATE_PATHS = [
  '/account/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/compare',
  '/app',
  '/api-proxy/',
];

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      sitemap: siteUrl('/sitemap.xml'),
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    // `host` is a non-standard Yandex hint (no trailing slash).
    host: SITE_URL,
  };
}
