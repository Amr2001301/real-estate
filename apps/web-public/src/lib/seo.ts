import type { Metadata } from 'next';

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

/** Brand fallback social image used when a page has no specific cover. */
export const DEFAULT_OG_IMAGE = '/og-default.svg';

interface BuildMetaInput extends Partial<Metadata> {
  title?: string;
  /** Cover image URL → OpenGraph + Twitter card image. */
  image?: string;
  /** Absolute path → canonical + og:url. */
  path?: string;
}

/** Build page metadata with polished Arabic + OpenGraph + Twitter defaults. */
export function buildMetadata({
  title,
  description,
  image,
  path,
  openGraph,
  twitter,
  ...rest
}: BuildMetaInput = {}): Metadata {
  const fullTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} · ${SITE.tagline}`;
  const desc = (description as string) ?? SITE.description;
  // Fall back to the brand OG image when a page has no specific cover.
  const images = [image ?? DEFAULT_OG_IMAGE];

  return {
    metadataBase: new URL(SITE_URL),
    title: fullTitle,
    description: desc,
    icons: { icon: '/favicon.ico' },
    robots: { index: true, follow: true },
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: fullTitle,
      description: desc,
      type: 'website',
      locale: SITE.locale,
      siteName: SITE.name,
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
