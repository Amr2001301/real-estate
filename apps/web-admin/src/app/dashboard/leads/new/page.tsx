import { api, safe } from '@/lib/api';
import type { Paged, Project, LeadSource, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import LeadForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewLeadPage() {
  const [projectsRes, sourcesRes, salesRes] = await Promise.all([
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
    safe(api.get<LeadSource[]>('/lead-sources')),
    safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة عميل محتمل جديد"
        description="سجّل بيانات العميل الأساسية وأسنده إلى أحد مندوبي المبيعات لمتابعته في خط الأنابيب."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العملاء المحتملون', href: '/dashboard/leads' },
          { label: 'عميل جديد' },
        ]}
      />
      <LeadForm
        projects={projectsRes.data?.data ?? []}
        sources={sourcesRes.data ?? []}
        sales={salesRes.data?.data ?? []}
      />
    </div>
  );
}
