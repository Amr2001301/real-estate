import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import type { InstallmentPlanTemplate } from '@/lib/types';
import PlanForm from '../../_form';

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

export default async function EditInstallmentPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [planRes, projectsRes] = await Promise.all([
    safe(api.get<InstallmentPlanTemplate>(`/installment-plan-templates/${id}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
  ]);

  if (planRes.error || !planRes.data) notFound();

  const plan = planRes.data;
  const projects = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="تعديل خطة التقسيط"
        description={plan.name}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'خطط التقسيط', href: '/dashboard/installments' },
          { label: plan.name, href: `/dashboard/installments/${id}` },
          { label: 'تعديل' },
        ]}
      />
      <PlanForm projects={projects} initialData={plan} mode="edit" />
    </div>
  );
}
