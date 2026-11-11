import { Container } from '@/components/ui/Container';
import { ArticleCard, type ArticleSummary } from '@/components/content/ArticleCard';
import type { Locale } from '@/lib/locale';
import { routes } from '@/lib/routes';
import { SectionHead } from './SectionHead';

/**
 * «أحدث المقالات» on the homepage: the company's three latest published
 * articles and a link to all of them. Nothing when it has published none.
 */
export function HomeArticles({ articles, locale }: { articles: ArticleSummary[]; locale: Locale }) {
  if (articles.length === 0) return null;
  const en = locale === 'en';
  return (
    <section className="pt-20 sm:pt-28" data-testid="home-articles">
      <Container>
        <SectionHead
          eyebrow={en ? 'Articles' : 'المقالات'}
          title={en ? 'Latest articles & tips' : 'أحدث المقالات والنصائح'}
          sub={en ? 'Guides and market notes to help you choose and buy with confidence.' : 'أدلة ونصائح عن السوق تساعدك تختار وتشتري بثقة.'}
          action={{ href: routes.articles, label: en ? 'All articles' : 'كل المقالات' }}
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.slice(0, 3).map((a) => (
            <ArticleCard key={a.id} article={a} locale={locale} />
          ))}
        </div>
      </Container>
    </section>
  );
}
