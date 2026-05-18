import { api, safe } from '@/lib/api';
import type { Paged, PortalLead, PortalUnit } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import PortalReservationForm from '../_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function NewPortalReservationPage() {
  const [leadsRes, unitsRes] = await Promise.all([
    safe(
      api.get<Paged<PortalLead>>(
        '/portal/leads?brokerApprovalStatus=APPROVED&pageSize=200',
      ),
    ),
    safe(
      api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=500'),
    ),
  ]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="حجز جديد"
        description="أنشئ حجزاً لفرصة معتمدة على وحدة متاحة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الحجوزات', href: '/portal/reservations' },
          { label: 'حجز جديد' },
        ]}
      />
      <PortalReservationForm
        approvedLeads={leadsRes.data?.data ?? []}
        units={unitsRes.data?.data ?? []}
      />
    </div>
  );
}
