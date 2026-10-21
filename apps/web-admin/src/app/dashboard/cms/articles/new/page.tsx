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

      <ArticleForm mode="create" />
    </div>
  );
}
