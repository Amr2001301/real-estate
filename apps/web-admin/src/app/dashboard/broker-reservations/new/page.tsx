import { BookmarkCheck } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
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
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { PremiumPageHero } from '@/components/premium';
import { AdminBrokerReservationForm } from './_form';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  brokerId?: string;
  brokerAgentId?: string;
  projectId?: string;
}

export default async function NewAdminBrokerReservationPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const [brokersRes, projectsRes, currency, locale] = await Promise.all([
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200&status=ACTIVE')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    getReportsCurrency(),
    getLocale(),
  ]);
  const m = uiT(locale);
  const n = m.pages.brokerReservationsNew;
  const symbol = currencySymbol(currency);

  const brokers = (brokersRes.data?.data ?? []).filter((b) => b.status === 'ACTIVE');
  const projects = projectsRes.data?.data ?? [];

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
      <PremiumPageHero
        title={n.title}
        description={n.description}
        breadcrumbs={[
          { label: m.common.breadcrumbHome, href: '/dashboard' },
          { label: m.nav.items.brokerReservations, href: '/dashboard/broker-reservations' },
          { label: n.breadcrumb },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <BookmarkCheck className="h-3.5 w-3.5" />
            {n.badge}
          </span>
        }
      />

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
        symbol={symbol}
        locale={locale}
      />
    </div>
  );
}
