import type { Metadata } from 'next';

export const SITE = {
  name: 'دار الفخامة',
  tagline: 'تجربة عقارية فاخرة تبدأ من هنا',
  description:
    'اكتشف مشاريع ووحدات سكنية مختارة بعناية لأسلوب حياة أرقى — تجربة عقارية فاخرة وموثوقة.',
  locale: 'ar_SA',
} as const;

/** Build page metadata with sensible Arabic + OpenGraph defaults. */
export function buildMetadata(overrides: Partial<Metadata> & { title?: string } = {}): Metadata {
  const title = overrides.title ? `${overrides.title} · ${SITE.name}` : `${SITE.name} · ${SITE.tagline}`;
  const description = (overrides.description as string) ?? SITE.description;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: SITE.locale,
      siteName: SITE.name,
    },
    ...overrides,
  };
}
