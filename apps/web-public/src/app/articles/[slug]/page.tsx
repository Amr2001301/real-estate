import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { getResolvedTenant } from '@/lib/tenant';
import { getLocale } from '@/lib/locale';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';

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
    ? await safeFetch<ArticleDetail>(`/public/articles/${slug}`, { revalidate: 60, tenantSlug: tenant.slug })
    : { ok: false as const, error: { message: '', status: 404 } };
  if (!res.ok) return buildMetadata({ title: 'مقال' });
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
    safeFetch<ArticleDetail>(`/public/articles/${slug}`, { revalidate: 60, tenantSlug: tenant.slug }),
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

  return (
    <>
      <PageHero
        eyebrow={isRtl ? 'مقالاتنا' : 'Articles'}
        title={article.title}
        subtitle={article.excerpt}
      />

      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            {article.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.coverUrl}
                alt=""
                className="w-full rounded-2xl mb-8 object-cover max-h-80"
              />
            )}

            <PremiumCard className="p-8 sm:p-10">
              <p className="text-xs text-ink-muted mb-6">
                {new Date(article.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>

              {/* Sanitized article body */}
              <div
                dir={isRtl ? 'rtl' : 'ltr'}
                className="article-body text-sm leading-loose text-ink-strong
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-ink-strong
                  [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5
                  [&_p]:mb-4 [&_p]:leading-loose
                  [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:mb-4 [&_ul_li]:mb-1
                  [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:mb-4 [&_ol_li]:mb-1
                  [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-4
                  [&_strong]:font-semibold [&_em]:italic
                  [&_blockquote]:border-s-4 [&_blockquote]:border-brand-300 [&_blockquote]:ps-4 [&_blockquote]:italic [&_blockquote]:text-ink-muted [&_blockquote]:my-4
                  [&_a]:text-brand-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-brand-800"
                // Only safe HTML — DOMPurify strips all scripts and dangerous attrs.
                dangerouslySetInnerHTML={{ __html: cleanBody }}
              />
            </PremiumCard>
          </div>
        </Container>
      </Section>
    </>
  );
}
