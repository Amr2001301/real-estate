import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { fetchPage } from '@/lib/cms';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [tenant, locale] = await Promise.all([getResolvedTenant(), getLocale()]);
  const res = tenant ? await fetchPage(tenant.slug, slug, locale) : null;
  if (!res?.ok) return buildMetadata({ title: locale === 'ar' ? 'صفحة' : 'Page' });
  return buildMetadata({
    path: `/pages/${slug}`,
    title: res.data.title,
    description: res.data.body.slice(0, 160),
  });
}

/**
 * A company page written on the dashboard's content page («المحتوى» →
 * الصفحات): about us, policies… Its text is plain; a blank line starts a
 * new paragraph.
 */
export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const locale = await getLocale();
  const res = await fetchPage(tenant.slug, slug, locale);
  if (!res.ok) notFound();

  const page = res.data;
  const paragraphs = page.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <PageHero title={page.title} compact />
      <Section tone="canvas">
        <Container>
          <PremiumCard className="mx-auto max-w-3xl p-8 sm:p-10">
            <div data-testid="cms-page-body" dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4 text-[15px] leading-loose text-ink-strong">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          </PremiumCard>
        </Container>
      </Section>
    </>
  );
}
