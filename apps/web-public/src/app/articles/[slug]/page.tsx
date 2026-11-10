import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { buildMetadata } from '@/lib/seo';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { Container } from '@/components/ui/Container';
import Link from 'next/link';
import type { Route } from 'next';
import { CoverImage } from '@/components/ui/CoverImage';
import { ShareButton } from '@/components/ui/ShareButton';
import { RichText } from '@/components/content/RichText';
import { ArticleCard, type ArticleSummary } from '@/components/content/ArticleCard';
import { DetailHead } from '@/components/detail/DetailStats';
import { ContactCta } from '@/components/marketing/ContactCta';
import { fetchBranding } from '@/lib/branding';
import { formatDateShort, formatNumber } from '@/lib/format';

export const revalidate = 60;

interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  createdAt: string;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tenant = await getResolvedTenant();
  const res = tenant
    ? await apiFetch<ArticleDetail>(`/public/articles/${slug}`, { revalidate: 60, tenantSlug: tenant.slug })
    : { ok: false as const, error: { message: '', status: 404 } };
  if (!res.ok) return buildMetadata({ title: (await getLocale()) === 'en' ? 'Article' : 'مقال' });
  return buildMetadata({
    title: res.data.title,
    description: res.data.excerpt,
  });
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();

  const [res, locale] = await Promise.all([
    apiFetch<ArticleDetail>(`/public/articles/${slug}`, { revalidate: 60, tenantSlug: tenant.slug }),
    getLocale(),
  ]);

  if (!res.ok) notFound();

  const article = res.data;
  const isRtl = locale === 'ar';

  // Sanitize HTML body to prevent XSS — allow standard formatting + img tags
  const cleanBody = DOMPurify.sanitize(article.body ?? '', {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'img', 'figure', 'figcaption',
      'a', 'blockquote', 'hr',
    ],
    ALLOWED_ATTR: ['src', 'alt', 'href', 'target', 'rel', 'class'],
    FORCE_BODY: true,
  });

  const [others, branding] = await Promise.all([
    apiFetch<ArticleSummary[]>('/public/articles', { revalidate: 120, tenantSlug: tenant.slug }).then((r) => (r.ok ? r.data.filter((x) => x.slug !== article.slug).slice(0, 3) : [])),
    fetchBranding(tenant.slug),
  ]);
  const plain = !/<[a-z][\s\S]*>/i.test(article.body ?? '');
  const words = (article.body ?? '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));

  return (
    <>
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <div className="mx-auto max-w-3xl">
            <nav className="text-sm text-ink-muted" aria-label={isRtl ? 'مسار التنقل' : 'Breadcrumb'}>
              <Link href={'/articles' as Route} className="hover:text-ink-strong">{isRtl ? 'المقالات' : 'Articles'}</Link>
            </nav>
            <p className="mt-6 text-[14px] font-medium text-gold-700 dark:text-gold-300">
              {formatDateShort(article.createdAt, locale)} · {isRtl ? `${formatNumber(minutes, locale)} دقائق قراءة` : `${formatNumber(minutes, locale)} min read`}
            </p>
            <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.35] text-ink-strong sm:text-[3rem]">{article.title}</h1>
            {article.excerpt && <p className="mt-4 text-[19px] leading-[1.9] text-ink-muted">{article.excerpt}</p>}
          </div>
          {article.coverUrl && (
            <div className="relative mt-10 h-[260px] overflow-hidden rounded-[1.75rem] sm:h-[460px]">
              <CoverImage src={article.coverUrl} alt={article.title} className="absolute inset-0 h-full" />
            </div>
          )}
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            {plain ? (
              <RichText body={article.body ?? ''} />
            ) : (
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="article-body text-[17px] leading-[2] text-ink
                  [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-[1.6rem] [&_h2]:font-semibold [&_h2]:text-ink-strong
                  [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-[1.25rem] [&_h3]:font-semibold [&_h3]:text-ink-strong
                  [&_p]:mb-5 [&_p]:text-ink-muted
                  [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:ps-6 [&_ul_li]:mb-1.5 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:ps-6 [&_ol_li]:mb-1.5
                  [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-2xl [&_strong]:font-semibold [&_strong]:text-ink-strong [&_em]:italic
                  [&_blockquote]:my-6 [&_blockquote]:border-s-4 [&_blockquote]:border-gold-400 [&_blockquote]:ps-5 [&_blockquote]:font-display [&_blockquote]:text-[1.2rem] [&_blockquote]:text-ink-strong
                  [&_a]:font-semibold [&_a]:text-navy [&_a]:underline [&_a]:underline-offset-4"
                // Only safe HTML — DOMPurify strips all scripts and dangerous attrs.
                dangerouslySetInnerHTML={{ __html: cleanBody }}
              />
            )}
            <div className="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-6">
              <span className="text-[15px] font-semibold text-ink-strong">{isRtl ? 'شارك المقال' : 'Share this article'}</span>
              <ShareButton title={article.title} variant="card" />
            </div>
          </div>
        </Container>
      </section>

      {others.length > 0 && (
        <section className="bg-surface-soft/60 py-16 sm:py-20">
          <Container>
            <DetailHead eyebrow={isRtl ? 'مقالات' : 'Articles'} title={isRtl ? 'اقرأ أيضًا' : 'Read next'} />
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((a) => (
                <ArticleCard key={a.id} article={a} locale={locale} />
              ))}
            </div>
          </Container>
        </section>
      )}
      <ContactCta locale={locale} branding={branding} image={article.coverUrl} />
    </>
  );
}
