import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/page-meta';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { Container } from '@/components/ui/Container';
import { ListHero } from '@/components/layout/ListHero';
import { ArticleCard, type ArticleSummary } from '@/components/content/ArticleCard';
import { ContactCta } from '@/components/marketing/ContactCta';
import { fetchBranding } from '@/lib/branding';
import { formatNumber } from '@/lib/format';

export async function generateMetadata() {
  return pageMeta('articles');
}

export const revalidate = 120;


export default async function ArticlesListPage() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const [articles, locale] = await Promise.all([
    apiFetch<ArticleSummary[]>('/public/articles', { revalidate: 120, tenantSlug: tenant.slug }),
    getLocale(),
  ]);

  const list = articles.ok ? articles.data : [];
  const isRtl = locale === 'ar';
  const [lead, ...rest] = list;
  const branding = await fetchBranding(tenant.slug);

  return (
    <>
      <ListHero
        homeLabel={isRtl ? 'الرئيسية' : 'Home'}
        title={isRtl ? 'مقالات ونصائح عقارية' : 'Articles & insights'}
        subtitle={isRtl ? 'أدلة ومقارنات ونصائح تساعدك تختار وتشتري بثقة.' : 'Guides, comparisons and tips to choose and buy with confidence.'}
        stats={list.length ? [{ value: formatNumber(list.length, locale), label: isRtl ? 'مقال' : 'articles' }] : []}
      />
      <section className="relative z-10 -mt-16 pb-6 sm:-mt-20">
        <Container>
          {!lead ? (
            <div className="rounded-[1.75rem] border border-hairline bg-surface py-20 text-center text-ink-muted">
              {isRtl ? 'لا توجد مقالات بعد.' : 'No articles yet.'}
            </div>
          ) : (
            <>
              <ArticleCard article={lead} locale={locale} lead />
              {rest.length > 0 && (
                <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((a) => (
                    <ArticleCard key={a.id} article={a} locale={locale} />
                  ))}
                </div>
              )}
            </>
          )}
        </Container>
      </section>
      <ContactCta locale={locale} branding={branding} image={lead?.coverUrl ?? null} />
    </>
  );
}
