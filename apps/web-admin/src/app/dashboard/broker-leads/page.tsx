import Link from 'next/link';
import { Users, Eye, Phone, Briefcase, AlertCircle, Search, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerLead,
  Broker,
  Paged,
  Project,
} from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import {
  BrokerLeadStatusBadge,
  LeadStageBadge,
} from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  brokerApprovalStatus?: string;
  stage?: string;
  projectId?: string;
  q?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerLeadsPage;

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of [
    'brokerId',
    'brokerApprovalStatus',
    'stage',
    'projectId',
    'q',
  ] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [leadsRes, brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerLead>>(`/broker-leads?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = leadsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  // Page-scoped counts (current page rows only)
  const counts = {
    pending: rows.filter((r) => r.brokerApprovalStatus === 'PENDING').length,
    approved: rows.filter((r) => r.brokerApprovalStatus === 'APPROVED').length,
    rejected: rows.filter((r) => r.brokerApprovalStatus === 'REJECTED').length,
    duplicate: rows.filter((r) => r.brokerApprovalStatus === 'DUPLICATE').length,
    noSales: rows.filter((r) => !r.assignedSales).length,
  };

  const totalLeads = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.brokerId || sp.brokerApprovalStatus || sp.stage || sp.projectId);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.q || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      q: sp.q,
      brokerId: sp.brokerId,
      brokerApprovalStatus: sp.brokerApprovalStatus,
      stage: sp.stage,
      projectId: sp.projectId,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-leads${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.heroTitle}
        description={m.heroDescription}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: m.breadcrumbSelf },
        ]}
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: m.kpiTotal,
            value: totalLeads,
            icon: <Users />,
            tone: 'brand',
            primary: true,
          },
          {
            label: m.kpiPending,
            value: counts.pending,
            icon: <Users />,
            tone: 'warning',
            sub: m.kpiThisPage,
          },
          {
            label: m.kpiApproved,
            value: counts.approved,
            icon: <Users />,
            tone: 'success',
            sub: m.kpiThisPage,
          },
          {
            label: m.kpiRejected,
            value: counts.rejected,
            icon: <Users />,
            tone: 'danger',
            sub: m.kpiThisPage,
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {leadsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorLoad}{leadsRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-leads">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.brokerId             && <input type="hidden" name="brokerId"             value={sp.brokerId} />}
        {!showFilters && sp.brokerApprovalStatus && <input type="hidden" name="brokerApprovalStatus" value={sp.brokerApprovalStatus} />}
        {!showFilters && sp.stage                && <input type="hidden" name="stage"                value={sp.stage} />}
        {!showFilters && sp.projectId            && <input type="hidden" name="projectId"            value={sp.projectId} />}

        {/* ── Row 1: search + actions (always visible) ──────────────────────── */}
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="bl-q" className="sr-only">{m.searchLabel}</label>
          <Input
            id="bl-q"
            name="q"
            inputSize="sm"
            placeholder={m.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            leftAddon={<Search />}
            className="w-full"
          />
        </div>

        {/* Action buttons — BEFORE the basis-full panel so ms-auto keeps them in row 1 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {hasAnyFilter && (
            <Link href={'/dashboard/broker-leads' as never}>
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? m.filterHideFilters : m.filterAdvanced}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </Link>
        </div>

        {/* ── Row 2: advanced panel (basis-full forces a new flex row) ─────── */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bl-broker" className="text-[11px] font-medium text-slate-400">{m.filterBroker}</label>
                <Select id="bl-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''}>
                  <option value="">{m.filterAllBrokers}</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.companyName}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bl-status" className="text-[11px] font-medium text-slate-400">{m.filterReviewStatus}</label>
                <Select id="bl-status" name="brokerApprovalStatus" inputSize="sm" defaultValue={sp.brokerApprovalStatus ?? ''}>
                  <option value="">{m.filterAllStatuses}</option>
                  <option value="PENDING">{m.filterStatusPending}</option>
                  <option value="APPROVED">{m.filterStatusApproved}</option>
                  <option value="REJECTED">{m.filterStatusRejected}</option>
                  <option value="DUPLICATE">{m.filterStatusDuplicate}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bl-stage" className="text-[11px] font-medium text-slate-400">{m.filterStage}</label>
                <Select id="bl-stage" name="stage" inputSize="sm" defaultValue={sp.stage ?? ''}>
                  <option value="">{m.filterAllStages}</option>
                  <option value="NEW">{m.filterStageNew}</option>
                  <option value="INTERESTED">{m.filterStageInterested}</option>
                  <option value="VISIT">{m.filterStageVisit}</option>
                  <option value="NEGOTIATION">{m.filterStageNegotiation}</option>
                  <option value="WON">{m.filterStageWon}</option>
                  <option value="LOST">{m.filterStageLost}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bl-project" className="text-[11px] font-medium text-slate-400">{m.filterProject}</label>
                <Select id="bl-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">{m.filterAllProjects}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Leads table ──────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<Users />}
        title={m.tableTitle}
        description={m.tableDescription}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {totalLeads.toLocaleString('ar-EG')} {m.tableTrailingCount}
          </span>
        }
      >
        {rows.length === 0 && !leadsRes.error ? (
          <PremiumEmptyState
            icon={<Users />}
            title={m.emptyTitle}
            description={m.emptyDescription}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">{m.colClient}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colBroker}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colProject}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colReview}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colStage}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colSales}</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">{m.colDate}</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    className="align-middle hover:bg-canvas/40 transition-colors duration-100"
                  >
                    {/* Client */}
                    <td className="py-3.5 ps-5 pe-4">
                      <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {l.fullName}
                      </p>
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 text-2xs text-slate-400"
                        dir="ltr"
                      >
                        <Phone className="h-3 w-3 shrink-0" />
                        {l.phone}
                      </span>
                    </td>

                    {/* Broker */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/dashboard/brokers/${l.brokerId}` as never}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">
                          {l.broker?.companyName ?? '—'}
                        </span>
                      </Link>
                      {l.brokerAgent && (
                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                          {l.brokerAgent.fullName}
                        </p>
                      )}
                    </td>

                    {/* Project */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-600 text-sm truncate max-w-[180px]">
                        {l.projectInterest ? (
                          tx(l.projectInterest.name)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </p>
                      {l.unitInterest && (
                        <p className="text-2xs text-slate-400 font-mono mt-0.5" dir="ltr">
                          {l.unitInterest.code}
                        </p>
                      )}
                    </td>

                    {/* Review status */}
                    <td className="py-3.5 px-4">
                      {l.brokerApprovalStatus ? (
                        <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <LeadStageBadge stage={l.stage} />
                    </td>

                    {/* Assigned sales */}
                    <td className="py-3.5 px-4">
                      {l.assignedSales ? (
                        <span className="block text-xs text-slate-700 truncate max-w-[140px]">
                          {l.assignedSales.fullName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          {m.unassigned}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(l.brokerSubmittedAt ?? l.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 ps-4 pe-5">
                      <Link href={`/dashboard/broker-leads/${l.id}` as never}>
                        <IconButton label={m.actionView} variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paged && paged.meta.total > PAGE_SIZE && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/broker-leads"
          params={{
            q: sp.q,
            brokerId: sp.brokerId,
            brokerApprovalStatus: sp.brokerApprovalStatus,
            stage: sp.stage,
            projectId: sp.projectId,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
