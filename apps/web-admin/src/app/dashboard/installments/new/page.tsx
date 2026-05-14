import { api, safe } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import PlanForm from '../_form';

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

export default async function NewInstallmentPlanPage() {
  const projectsRes = await safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100'));
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
      <PlanForm projects={projects} mode="create" />
    </div>
  );
}
