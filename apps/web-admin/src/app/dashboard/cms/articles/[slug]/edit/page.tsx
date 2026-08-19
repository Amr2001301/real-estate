import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, ChevronLeft } from 'lucide-react';
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

      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-hairline bg-surface-muted/20">
          <BookOpen className="h-4 w-4 text-brand-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">محتوى المقال</h3>
          <span className="font-mono text-xs text-slate-400 bg-surface-muted/60 px-1.5 py-0.5 rounded ms-1" dir="ltr">
            /{slug}
          </span>
        </div>
        <div className="px-5 py-5">
          <ArticleForm mode="edit" initial={initial} />
        </div>
      </div>

      <div className="flex">
        <Link
          href="/dashboard/cms"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          العودة إلى إدارة المحتوى
        </Link>
      </div>
    </div>
  );
}
