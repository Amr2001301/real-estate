import Link from 'next/link';
import { ChevronLeft, BookOpen } from 'lucide-react';
import { PremiumPageHero } from '@/components/premium';
import ArticleForm from '../_form';

export const dynamic = 'force-dynamic';

export default function NewArticlePage() {
  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="مقال جديد"
        description="إنشاء مقال جديد على المنصة مع محتوى نصي منسق وصور."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'إدارة المحتوى', href: '/dashboard/cms' },
          { label: 'مقال جديد' },
        ]}
      />

      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-hairline bg-surface-muted/20">
          <BookOpen className="h-4 w-4 text-brand-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">محتوى المقال</h3>
        </div>
        <div className="px-5 py-5">
          <ArticleForm mode="create" />
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
