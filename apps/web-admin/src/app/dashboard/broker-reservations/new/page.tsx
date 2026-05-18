import Link from 'next/link';
import { ChevronLeft, BookmarkCheck } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerLead,
  Broker,
  BrokerUser,
  Paged,
  Project,
  Unit,
  UnitStatus,
} from '@/lib/types';
import { tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminBrokerReservationForm } from './_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  brokerId?: string;
  brokerAgentId?: string;
  projectId?: string;
}

/**
 * Server component — pre-loads the dropdown data the form needs:
 *  - active brokers
 *  - active broker users for the selected broker (after first submit)
 *  - approved + sales-assigned leads for the selected broker
 *  - projects (small list) so the user can pick before the unit dropdown
 *  - AVAILABLE units inside the selected project
 *
 * Each cascading step lives in the URL so admins can deep-link straight into
 * the right state and so the page stays as a server component.
 */
export default async function NewAdminBrokerReservationPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const [brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200&status=ACTIVE')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const brokers = (brokersRes.data?.data ?? []).filter((b) => b.status === 'ACTIVE');
  const projects = projectsRes.data?.data ?? [];

  // Only load broker-scoped resources after the admin picks a broker.
  const brokerAgents = sp.brokerId
    ? ((await safe(api.get<BrokerUser[]>(`/brokers/${sp.brokerId}/users`))).data ?? [])
        .filter((u) => u.status === 'ACTIVE')
    : [];

  const approvedLeads = sp.brokerId
    ? ((
        await safe(
          api.get<Paged<AdminBrokerLead>>(
            `/broker-leads?brokerId=${sp.brokerId}&brokerApprovalStatus=APPROVED&pageSize=100`,
          ),
        )
      ).data?.data ?? [])
        .filter((l) => Boolean(l.assignedSalesId))
    : [];

  const units = sp.projectId
    ? ((
        await safe(
          api.get<Paged<Unit>>(`/units?projectId=${sp.projectId}&status=AVAILABLE&pageSize=200`),
        )
      ).data?.data ?? [])
        .filter((u) => (u.status as UnitStatus) === 'AVAILABLE')
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إنشاء حجز نيابة عن وسيط"
        description="استخدم هذا النموذج عندما يطلب الوسيط الحجز عبر الهاتف أو الواتساب. ستظهر الحجز في بوابة الوسيط كأنه أنشأه بنفسه."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'حجوزات من الوسطاء', href: '/dashboard/broker-reservations' },
          { label: 'حجز جديد' },
        ]}
        meta={<BookmarkCheck className="h-4 w-4 text-brand-600" />}
        actions={
          <Link href="/dashboard/broker-reservations">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <Card className="p-5">
        <AdminBrokerReservationForm
          brokers={brokers.map((b) => ({
            id: b.id,
            companyName: b.companyName,
            code: b.code,
            defaultCommissionPct: Number(b.defaultCommissionPct ?? 0),
          }))}
          selectedBrokerId={sp.brokerId ?? ''}
          brokerAgents={brokerAgents.map((a) => ({
            id: a.id,
            fullName: a.user.fullName,
            email: a.user.email,
          }))}
          selectedBrokerAgentId={sp.brokerAgentId ?? ''}
          approvedLeads={approvedLeads.map((l) => ({
            id: l.id,
            fullName: l.fullName,
            phone: l.phone,
            projectInterestId: l.projectInterestId ?? null,
            projectInterestName: l.projectInterest ? tx(l.projectInterest.name) : null,
          }))}
          projects={projects.map((p) => ({
            id: p.id,
            name: tx(p.name),
            city: p.city,
          }))}
          selectedProjectId={sp.projectId ?? ''}
          units={units.map((u) => ({
            id: u.id,
            code: u.code,
            type: u.type,
            price: u.price,
            buildingName: u.building?.name ?? null,
          }))}
        />
      </Card>
    </div>
  );
}
