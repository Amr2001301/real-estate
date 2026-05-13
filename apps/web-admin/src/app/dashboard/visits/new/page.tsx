import { api, safe } from '@/lib/api';
import type { Paged, User, LeadStage, Project } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import NewVisitForm from './_form';

export const dynamic = 'force-dynamic';

interface UnitOption {
  id: string;
  code: string;
  type: string;
  building?: { phase?: { project?: { id: string; name: { ar: string; en: string } } } };
}

interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
  stage: LeadStage;
  projectInterest?: { id: string; name: { ar: string; en: string } } | null;
}

export default async function NewVisitPage() {
  const [meRes, projectsRes, unitsRes, leadsRes, clientsRes, customersRes, salesRes] =
    await Promise.all([
      safe(api.get<User>('/users/me')),
      safe(api.get<Paged<Project>>('/projects?pageSize=200')),
      safe(api.get<Paged<UnitOption>>('/units?pageSize=200')),
      safe(api.get<Paged<LeadOption>>('/leads?pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=CLIENT&pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=CUSTOMER&pageSize=200')),
      safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
    ]);

  const clients = [
    ...(clientsRes.data?.data ?? []),
    ...(customersRes.data?.data ?? []),
  ].map((u) => ({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role as 'CLIENT' | 'CUSTOMER',
  }));

  const currentRole = (meRes.data?.role ?? 'SALES') as 'ADMIN' | 'SALES';

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="زيارة جديدة"
        description="أنشئ زيارة جديدة مباشرة. يمكن ربطها بعميل محتمل، عميل مسجل، أو حفظها كزيارة بدون حساب."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الزيارات', href: '/dashboard/visits' },
          { label: 'زيارة جديدة' },
        ]}
      />

      <NewVisitForm
        currentRole={currentRole}
        projects={projectsRes.data?.data ?? []}
        units={unitsRes.data?.data ?? []}
        leads={leadsRes.data?.data ?? []}
        clients={clients}
        salesOptions={salesRes.data?.data ?? []}
      />
    </div>
  );
}
