import { api, safe } from '@/lib/api';
import { getReportsCurrency } from '@/lib/currency';
import { PageHeader } from '@/components/ui/page-header';
import PlanForm from '../_form';

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

export default async function NewInstallmentPlanPage() {
  const [projectsRes, currency] = await Promise.all([
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
    getReportsCurrency(),
  ]);
  const projects = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-6 pb-2">
      <PageHeader
        title="إنشاء خطة تقسيط"
        description="أنشئ خطة جديدة وربطها بمشروع أو وحدة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'خطط التقسيط', href: '/dashboard/installments' },
          { label: 'إنشاء خطة' },
        ]}
      />
      <PlanForm projects={projects} mode="create" currency={currency} />
    </div>
  );
}
