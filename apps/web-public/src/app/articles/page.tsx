import Link from 'next/link';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';

export const metadata = buildMetadata({
  title: 'المقالات',
  description: 'اقرأ أحدث المقالات والمعلومات العقارية على منصتنا.',
});

export const revalidate = 120;

interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  published: boolean;
  createdAt: string;
}

export default async function ArticlesListPage() {
  const [articles, locale] = await Promise.all([
    safeFetch<ArticleSummary[]>('/public/articles', { revalidate: 120 }),
    getLocale(),
  ]);

  const list = articles.ok ? articles.data : [];
  const isRtl = locale === 'ar';

  return (
    <>
      <PageHero
        eyebrow={isRtl ? 'مقالاتنا' : 'Articles'}
        title={isRtl ? 'أحدث المقالات' : 'Latest Articles'}
        subtitle={isRtl ? 'نصائح ومعلومات عقارية مختارة بعناية' : 'Curated real estate insights and tips'}
      />

      <Section tone="canvas">
        <Container>
          {list.length === 0 ? (
            <div className="py-20 text-center text-ink-muted">
              {isRtl ? 'لا توجد مقالات بعد.' : 'No articles yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((article) => (
                <Link key={article.id} href={`/articles/${article.slug}`} className="group block">
                  <PremiumCard className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                    {article.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={article.coverUrl}
                        alt=""
                        className="w-full h-44 object-cover"
                      />
                    )}
                    <div className="flex flex-col flex-1 p-5 gap-2">
                      <h2 className="text-base font-bold text-ink-strong group-hover:text-brand-600 transition-colors line-clamp-2">
                        {article.title}
                      </h2>
                      {article.excerpt && (
                        <p className="text-sm text-ink-muted line-clamp-3 flex-1">{article.excerpt}</p>
                      )}
                      <p className="text-xs text-ink-muted mt-auto">
                        {new Date(article.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                  </PremiumCard>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
