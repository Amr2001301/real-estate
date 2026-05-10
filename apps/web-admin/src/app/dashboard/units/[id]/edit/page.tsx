import { api, safe } from '@/lib/api';
import type { Paged, Project, Unit } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import UnitForm from '../../_form';

export const dynamic = 'force-dynamic';

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [unitRes, projectsRes] = await Promise.all([
    safe(api.get<Unit>(`/units/${id}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  if (unitRes.error || !unitRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل الوحدة: {unitRes.error ?? 'غير موجودة'}
      </div>
    );
  }

  const unit = unitRes.data;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`تعديل الوحدة ${unit.code}`}
        description="حدّث بيانات الوحدة، المواصفات الفنية، والتسعير. سيتم حفظ التغييرات فور التأكيد."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات', href: '/dashboard/units' },
          { label: unit.code, href: `/dashboard/units/${id}` },
          { label: 'تعديل' },
        ]}
      />
      <UnitForm unit={unit} projects={projectsRes.data?.data ?? []} />
    </div>
  );
}
