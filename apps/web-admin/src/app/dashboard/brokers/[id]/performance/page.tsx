import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  TrendingUp,
  Users as UsersIcon,
  Building2,
  BookmarkCheck,
  FileText,
  BadgePercent,
  Wallet,
  UserPlus,
  Banknote,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { BrokerDetailReport, Paged, Project } from '@/lib/types';
import { tx, formatCurrency, formatDate } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumMetricStrip } from '@/components/premium';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BrokerStatusBadge,
  BrokerCommissionStatusBadge,
  BrokerPayoutStatusBadge,
  BrokerLeadStatusBadge,
  LeadStageBadge,
  ReservationStatusBadge,
} from '@/components/badges';
import { MonthlyTrendChart } from '@/components/broker/monthly-trend-chart';
import { FunnelCard } from '@/components/broker/funnel-card';
import { ExportMenu } from '@/components/export-menu';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  from?: string;
  to?: string;
  projectId?: string;
  brokerAgentId?: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function BrokerPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [currency, locale] = await Promise.all([getReportsCurrency(), getLocale()]);
  const m = uiT(locale).pages.brokerPerformancePage;

  const qs = new URLSearchParams();
  for (const key of ['from', 'to', 'projectId', 'brokerAgentId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [reportRes, projectListRes] = await Promise.all([
    safe(api.get<BrokerDetailReport>(`/broker-reports/broker/${id}?${qs.toString()}`)),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);
  if (reportRes.error || !reportRes.data) notFound();
  const report = reportRes.data;
  const summary = report.summary;
  const projectList = projectListRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${m.titlePrefix}${report.broker.companyName}`}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: report.broker.companyName, href: `/dashboard/brokers/${id}` },
          { label: m.breadcrumbPerformance },
        ]}
        meta={
          <>
            <BrokerStatusBadge status={report.broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">{report.broker.code}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <ExportMenu
              xlsxPath={`/broker-reports/export/broker/${id}.xlsx`}
              csvPath={`/broker-reports/export/broker/${id}.csv`}
              filenameBase={`broker-${report.broker.code ?? id}`}
              params={{ from: sp.from, to: sp.to, projectId: sp.projectId, brokerAgentId: sp.brokerAgentId }}
            />
            <Link href={`/dashboard/brokers/${id}`}>
              <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {m.backBtn}
              </Button>
            </Link>
          </div>
        }
      />

      <form
        method="get"
        action={`/dashboard/brokers/${id}/performance`}
        className="rounded-xl border border-hairline bg-white p-3 shadow-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2"
      >
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">{m.filterAllProjects}</option>
          {projectList.map((p) => (
            <option key={p.id} value={p.id}>{tx(p.name)}</option>
          ))}
        </Select>
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
        <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end ms-auto md:col-start-5">
          <Button type="submit" variant="primary" size="sm">{m.filterBtn}</Button>
          {Object.values(sp).some(Boolean) && (
            <Link href={`/dashboard/brokers/${id}/performance`}>
              <Button type="button" variant="ghost" size="sm">{m.clearBtn}</Button>
            </Link>
          )}
        </div>
      </form>

      <PremiumMetricStrip
        variant="compact"
        cols={6}
        metrics={[
          { label: m.kpiLeads,            value: summary.leadsSubmitted,                  icon: <UserPlus />,     tone: 'brand'   },
          { label: m.kpiReservations,     value: summary.reservationsCreated,             icon: <BookmarkCheck />, tone: 'info'    },
          { label: m.kpiContractsSigned,  value: summary.contractsSigned,                 icon: <FileText />,     tone: 'purple'  },
          { label: m.kpiSalesGross,       value: formatCurrency(summary.salesGross, currency),     icon: <Banknote />,     tone: 'success', valueSize: 'compact' },
          { label: m.kpiCommissionsNet,   value: formatCurrency(summary.commissionsNet, currency),  icon: <BadgePercent />, tone: 'warning', valueSize: 'compact' },
          { label: m.kpiPaid,             value: formatCurrency(summary.payoutsTotalNet, currency), icon: <Wallet />,       tone: 'success', valueSize: 'compact' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-2xs text-slate-500">{m.rateLeadToRes}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.leadToReservationRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">{m.rateResToContract}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.reservationToContractRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">{m.rateSignedContracts}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.signedContractRate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xs text-slate-500">{m.rateContractToPayout}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pct(summary.contractToPaidPayoutRate)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FunnelCard summary={summary} />
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{m.quickReadTitle}</h2>
          <ul className="text-sm text-slate-700 space-y-2">
            <li>{m.quickReadApproved(summary.leadsApproved, summary.leadsSubmitted)}</li>
            <li>{m.quickReadCancelled(summary.reservationsCancelled)}</li>
            <li>{m.quickReadPendingSign(summary.contractsCreated - summary.contractsSigned)}</li>
            <li>{m.quickReadCommPending(summary.commissionsApproved)}</li>
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            {m.trendTitle}
          </h2>
          <p className="text-2xs text-slate-500">{m.trendDesc}</p>
        </div>
        <MonthlyTrendChart data={report.monthlyTrend} currency={currency} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">{m.projectsTitle}</h2>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">{m.colProject}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colContracts}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colSales}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colCommissionNet}</th>
                </tr>
              </thead>
              <tbody>
                {report.projectBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={<Building2 />} title={m.noProjectsTitle} description={m.noProjectsDesc} />
                    </td>
                  </tr>
                )}
                {report.projectBreakdown.map((p) => (
                  <tr key={p.projectId} className="border-t border-hairline">
                    <td className="py-3 ps-5 pe-4">
                      {p.projectName ? tx(p.projectName) : '—'}
                      {p.city && <p className="text-2xs text-slate-500 mt-0.5">{p.city}</p>}
                    </td>
                    <td className="py-3 px-4 tabular-nums">{p.contractsSigned} / {p.contracts}</td>
                    <td className="py-3 px-4 tabular-nums">{formatCurrency(p.salesGross, currency)}</td>
                    <td className="py-3 px-4 tabular-nums font-semibold">{formatCurrency(p.commissionNet, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">{m.agentsTitle}</h2>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">{m.colAgent}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colLeads}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colReservations}</th>
                  <th className="text-start font-semibold py-3 px-4">{m.colCommissionNet}</th>
                </tr>
              </thead>
              <tbody>
                {report.agentBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState icon={<UsersIcon />} title={m.noAgentsTitle} description="—" />
                    </td>
                  </tr>
                )}
                {report.agentBreakdown.map((a) => (
                  <tr key={a.brokerAgentId} className="border-t border-hairline">
                    <td className="py-3 ps-5 pe-4">
                      <p className="font-medium text-slate-900">{a.fullName}</p>
                      <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">{a.email ?? a.phone ?? '—'}</p>
                    </td>
                    <td className="py-3 px-4 tabular-nums">{a.leadsSubmitted}</td>
                    <td className="py-3 px-4 tabular-nums">{a.reservations}</td>
                    <td className="py-3 px-4 tabular-nums font-semibold">{formatCurrency(a.commissionNet, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{m.recentLeadsTitle}</h2>
            <Link href={`/dashboard/broker-leads?brokerId=${id}`}>
              <Button variant="ghost" size="sm">{m.viewAllBtn}</Button>
            </Link>
          </div>
          <ul className="divide-y divide-hairline">
            {report.recent.leads.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-500">—</li>
            )}
            {report.recent.leads.map((l) => (
              <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/broker-leads/${l.id}` as never} className="text-sm font-medium hover:text-brand-700">
                    {l.fullName}
                  </Link>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {l.projectInterest ? tx(l.projectInterest.name) : '—'} • {formatDate(l.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {l.brokerApprovalStatus && <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />}
                  <LeadStageBadge stage={l.stage} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{m.recentReservationsTitle}</h2>
            <Link href={`/dashboard/broker-reservations?brokerId=${id}`}>
              <Button variant="ghost" size="sm">{m.viewAllBtn}</Button>
            </Link>
          </div>
          <ul className="divide-y divide-hairline">
            {report.recent.reservations.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-500">—</li>
            )}
            {report.recent.reservations.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-900" dir="ltr">{r.reservationNumber ?? '—'}</p>
                  <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">{r.unit.code}</p>
                </div>
                <ReservationStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{m.recentContractsTitle}</h2>
            <Link href={`/dashboard/broker-contracts?brokerId=${id}`}>
              <Button variant="ghost" size="sm">{m.viewAllBtn}</Button>
            </Link>
          </div>
          <ul className="divide-y divide-hairline">
            {report.recent.contracts.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-500">—</li>
            )}
            {report.recent.contracts.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/contracts/${c.id}` as never} className="text-xs font-mono hover:text-brand-700" dir="ltr">
                    {c.contractNumber ?? '—'}
                  </Link>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {c.signedAt
                      ? m.contractSigned(formatDate(c.signedAt) ?? '—')
                      : m.contractPending(formatDate(c.createdAt) ?? '—')}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums">
                  {formatCurrency(c.totalAmount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{m.recentCommissionsTitle}</h2>
            <div className="flex items-center gap-1.5">
              <Link href={`/dashboard/broker-commissions?brokerId=${id}`}>
                <Button variant="ghost" size="sm">{m.commissionsBtn}</Button>
              </Link>
              <Link href={`/dashboard/broker-payouts?brokerId=${id}`}>
                <Button variant="ghost" size="sm">{m.payoutsBtn}</Button>
              </Link>
            </div>
          </div>
          <ul className="divide-y divide-hairline">
            {report.recent.commissions.slice(0, 5).map((c) => (
              <li key={`c-${c.id}`} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/broker-commissions/${c.id}` as never} className="text-xs font-mono hover:text-brand-700" dir="ltr">
                    {c.commissionNumber}
                  </Link>
                  <p className="text-2xs text-slate-500 mt-0.5">{formatDate(c.earnedAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <BrokerCommissionStatusBadge status={c.status} />
                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(c.netAmount, currency)}</span>
                </div>
              </li>
            ))}
            {report.recent.payouts.slice(0, 5).map((p) => (
              <li key={`p-${p.id}`} className="px-5 py-3 flex items-center justify-between gap-3 bg-surface-muted/30">
                <div className="min-w-0">
                  <Link href={`/dashboard/broker-payouts/${p.id}` as never} className="text-xs font-mono hover:text-brand-700" dir="ltr">
                    {p.payoutNumber}
                  </Link>
                  <p className="text-2xs text-slate-500 mt-0.5">{p.period ?? formatDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <BrokerPayoutStatusBadge status={p.status} />
                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(p.totalNet, currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
