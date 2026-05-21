import { api, safe } from '@/lib/api';
import type { Paged, Project, LeadSource, User } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import LeadForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const sp = await searchParams;

  const [projectsRes, sourcesRes, salesRes, clientRes] = await Promise.all([
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
    safe(api.get<LeadSource[]>('/lead-sources')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
    sp.clientId
      ? safe(api.get<User>(`/users/${sp.clientId}`))
      : Promise.resolve({ data: null, error: null } as { data: User | null; error: null }),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة فرصة CRM جديدة"
        description="سجّل فرصة بيع جديدة مرتبطة بعميل قائم أو جديد، وأسندها إلى مندوب لمتابعتها في خط الأنابيب."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'فرص المبيعات (CRM)', href: '/dashboard/leads' },
          { label: 'فرصة جديدة' },
        ]}
      />
      <LeadForm
        projects={projectsRes.data?.data ?? []}
        sources={sourcesRes.data ?? []}
        sales={salesRes.data?.data ?? []}
        initialClient={clientRes.data ?? null}
      />
    </div>
  );
}
