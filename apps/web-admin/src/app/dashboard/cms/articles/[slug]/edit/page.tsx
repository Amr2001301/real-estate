import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { PremiumPageHero } from '@/components/premium';
import ArticleForm from '../../_form';

export const dynamic = 'force-dynamic';

interface ArticleDetail {
  id: string;
  slug: string;
  title: { ar: string; en: string };
  excerpt: { ar: string; en: string };
  body: { ar: string; en: string };
  coverUrl: string | null;
  published: boolean;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditArticlePage({ params }: Props) {
  const { slug } = await params;
  const res = await safe(api.get<ArticleDetail>(`/cms/articles/${slug}`));
  if (!res.data) notFound();

  const a = res.data;
  const initial = {
    slug: a.slug,
    ar_title: typeof a.title === 'object' ? (a.title as { ar: string }).ar : '',
    en_title: typeof a.title === 'object' ? (a.title as { en: string }).en : '',
    ar_excerpt: typeof a.excerpt === 'object' ? (a.excerpt as { ar: string }).ar : '',
    en_excerpt: typeof a.excerpt === 'object' ? (a.excerpt as { en: string }).en : '',
    ar_body: typeof a.body === 'object' ? (a.body as { ar: string }).ar : '',
    en_body: typeof a.body === 'object' ? (a.body as { en: string }).en : '',
    coverUrl: a.coverUrl ?? undefined,
    published: a.published,
  };

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={`تعديل: ${initial.ar_title || slug}`}
        description="تعديل محتوى المقال وإعادة نشره."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'إدارة المحتوى', href: '/dashboard/cms' },
          { label: 'تعديل مقال' },
        ]}
      />

      <ArticleForm mode="edit" initial={initial} />
    </div>
  );
}
