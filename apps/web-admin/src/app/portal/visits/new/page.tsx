import { api, safe } from '@/lib/api';
import type { Paged, PortalLead, PortalProject, PortalUnit } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import PortalVisitForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewPortalVisitPage() {
  const [projectsRes, unitsRes, leadsRes] = await Promise.all([
    safe(api.get<PortalProject[]>('/portal/projects')),
    // pageSize is capped at 200 by PortalUnitsQueryDto (@Max(200)); requesting
    // more returns a 400 and an empty list, which is why the unit dropdown
    // appeared empty. 200 covers a broker's accessible units in one page.
    safe(api.get<Paged<PortalUnit>>('/portal/units?pageSize=200')),
    safe(api.get<Paged<PortalLead>>('/portal/leads?pageSize=200')),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="طلب زيارة جديدة"
        description="اقترح موعد زيارة لأحد عملائك في أحد المشاريع المتاحة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الزيارات', href: '/portal/visits' },
          { label: 'زيارة جديدة' },
        ]}
      />
      <PortalVisitForm
        projects={projectsRes.data ?? []}
        units={unitsRes.data}
        leads={leadsRes.data}
      />
    </div>
  );
}
