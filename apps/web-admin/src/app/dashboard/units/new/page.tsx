import { api, safe } from '@/lib/api';
import type { Paged, Project } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import UnitForm from '../_form';

export const dynamic = 'force-dynamic';

export default async function NewUnitPage() {
  const r = await safe(api.get<Paged<Project>>('/projects?pageSize=200'));

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة وحدة عقارية"
        description="أنشئ وحدة جديدة وحدّد بياناتها الأساسية، المواصفات الفنية، والتسعير."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات', href: '/dashboard/units' },
          { label: 'وحدة جديدة' },
        ]}
      />
      {r.error ? (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {r.error}
        </div>
      ) : (
        <UnitForm projects={r.data?.data ?? []} />
      )}
    </div>
  );
}
