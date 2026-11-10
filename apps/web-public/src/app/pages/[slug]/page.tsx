import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { fetchPage } from '@/lib/cms';
import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { RichText } from '@/components/content/RichText';
import { ContactCta } from '@/components/marketing/ContactCta';
import { fetchBranding } from '@/lib/branding';
import { apiFetch } from '@/lib/api-server';
import type { Paginated, PublicProjectListItem } from '@/lib/api-types';
import { siteT } from '@/messages/site';

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
  const [branding, projects] = await Promise.all([
    fetchBranding(tenant.slug),
    apiFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=6', { revalidate: 300, tenantSlug: tenant.slug }),
  ]);
  const photo = projects.ok ? projects.data.data.find((p) => p.coverImage?.trim())?.coverImage ?? null : null;
  const m = siteT(locale);

  return (
    <>
      <ListHero homeLabel={m.unitDetail.breadHome} title={page.title} />
      <section className="relative z-10 -mt-16 sm:-mt-20">
        <Container>
          <article dir={locale === 'ar' ? 'rtl' : 'ltr'} className="mx-auto max-w-4xl rounded-[1.75rem] border border-hairline bg-surface p-7 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)] sm:p-14">
            <RichText body={page.body} />
          </article>
        </Container>
      </section>
      <ContactCta locale={locale} branding={branding} image={photo} />
    </>
  );
}
