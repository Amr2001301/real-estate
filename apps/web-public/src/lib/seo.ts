import type { Metadata } from 'next';
import type { BrandingData } from './branding';
import type { Locale } from './locale';

export const SITE = {
  name: 'ديفورا',
  tagline: 'تجربة عقارية فاخرة تبدأ من هنا',
  description:
    'اكتشف مشاريع ووحدات سكنية مختارة بعناية لأسلوب حياة أرقى — تجربة عقارية فاخرة وموثوقة.',
  locale: 'ar_SA',
} as const;

/** Public site origin. Configurable via NEXT_PUBLIC_SITE_URL / SITE_URL. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  'http://localhost:3002'
).replace(/\/$/, '');

export function siteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Brand fallback social image used when a page has no specific cover (PNG: WhatsApp, Facebook and X don't render SVG previews). */
export const DEFAULT_OG_IMAGE = '/og-default.png';

interface BuildMetaInput extends Partial<Metadata> {
  title?: string;
  /** Cover image URL → OpenGraph + Twitter card image. */
  image?: string;
  /** Absolute path → canonical + og:url. */
  path?: string;
  /** Per-tenant branding — overrides SITE.name, SITE.tagline, og-image, favicon. */
  branding?: BrandingData;
  /** Current locale for tagline + contactAddress selection. */
  locale?: Locale;
  /**
   * The root layout's call: it carries the company's name, og image and favicon
   * and sets the title template every page inherits (`%s · Company`).
   */
  root?: boolean;
}

/** Build page metadata with polished Arabic + OpenGraph + Twitter defaults. */
export function buildMetadata({
  title,
  description,
  image,
  path,
  branding,
  locale,
  root,
  openGraph,
  twitter,
  ...rest
}: BuildMetaInput = {}): Metadata {
  // A page's own metadata says only what is the page's — its title, description,
  // cover and path. The company's name, favicon and default share image come from
  // the root layout, which knows the tenant: a page that wrote «· ديفورا» or the
  // platform's og image itself showed the platform's identity on every company's
  // site (QA F-009, F-054). Next replaces `openGraph` as a whole, so a page that
  // wants its cover passes `branding` to keep the company's site name.
  if (!root && !branding) {
    const images = image ? [image] : undefined;
    return {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(path ? { alternates: { canonical: path } } : {}),
      ...(images || openGraph
        ? { openGraph: { ...(title ? { title } : {}), ...(description ? { description: description as string } : {}), ...(path ? { url: path } : {}), ...(images ? { images } : {}), ...((openGraph as object) ?? {}) } }
        : {}),
      ...rest,
    };
  }
  const siteName    = branding?.displayName ?? branding?.name ?? SITE.name;
  const siteTagline = (locale && branding?.tagline?.[locale]) ?? SITE.tagline;
  const fullTitle   = title ? `${title} · ${siteName}` : `${siteName} · ${siteTagline}`;
  const desc        = (description as string) ?? SITE.description;
  // Tenant og-image supersedes the platform default when present.
  // A company without its own share image shows its logo, never the platform's mark.
  const images = [image ?? branding?.ogImageUrl ?? branding?.logoUrl ?? DEFAULT_OG_IMAGE];

  return {
    metadataBase: new URL(SITE_URL),
    // The root sets the template; a page that has the company's branding is absolute.
    title: root ? { default: fullTitle, template: `%s · ${siteName}` } : { absolute: fullTitle },
    description: desc,
    icons: { icon: branding?.faviconUrl ?? branding?.logoUrl ?? '/favicon.ico' },
    robots: { index: true, follow: true },
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: fullTitle,
      description: desc,
      type: 'website',
      locale: SITE.locale,
      siteName: siteName,
      ...(path ? { url: path } : {}),
      ...(images ? { images } : {}),
      ...((openGraph as object) ?? {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: desc,
      ...(images ? { images } : {}),
      ...((twitter as object) ?? {}),
    },
    ...rest,
  };
}
