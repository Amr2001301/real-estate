import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalUnit } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import PortalLeadForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewPortalLeadPage() {
  const [projectsRes, unitsRes] = await Promise.all([
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?pageSize=500')),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة فرصة جديدة"
        description="سجّل بيانات عميل محتمل لإحالته إلى فريق المبيعات."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص', href: '/portal/leads' },
          { label: 'فرصة جديدة' },
        ]}
      />
      <PortalLeadForm
        projects={projectsRes.data ?? []}
        units={unitsRes.data}
      />
    </div>
  );
}
