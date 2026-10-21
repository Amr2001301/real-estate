import Link from 'next/link';
import { Users, Eye, Phone, AlertCircle, Search, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, brokerOptions } from '@/lib/options';
import type { AdminBrokerLead, Paged } from '@/lib/types';
import { tx, formatDate, intlLocale } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import {
  PremiumPageHero,
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

const REVIEW_CHIP: Record<string, string> = {
  PENDING: 'bg-amber-500/12 text-amber-600',
  APPROVED: 'bg-emerald-500/12 text-emerald-600',
  REJECTED: 'bg-rose-500/12 text-rose-500',
  DUPLICATE: 'bg-slate-500/12 text-slate-500',
};

const STAGE_CHIP: Record<string, string> = {
  NEW: 'bg-slate-500/12 text-slate-500',
  INTERESTED: 'bg-sky-500/12 text-sky-600',
  VISIT: 'bg-violet-500/12 text-violet-600',
  NEGOTIATION: 'bg-amber-500/12 text-amber-600',
  WON: 'bg-emerald-500/12 text-emerald-600',
  LOST: 'bg-rose-500/12 text-rose-500',
};

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
    safe(brokerOptions()),
    safe(projectOptions()),
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

  const reviewLabel: Record<string, string> = {
    PENDING: m.filterStatusPending,
    APPROVED: m.filterStatusApproved,
    REJECTED: m.filterStatusRejected,
    DUPLICATE: m.filterStatusDuplicate,
  };
  const stageLabel: Record<string, string> = {
    NEW: m.filterStageNew,
    INTERESTED: m.filterStageInterested,
    VISIT: m.filterStageVisit,
    NEGOTIATION: m.filterStageNegotiation,
    WON: m.filterStageWon,
    LOST: m.filterStageLost,
  };

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
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.kpiTotal, value: totalLeads },
            { label: m.kpiPending, value: counts.pending, sub: m.kpiThisPage, warn: counts.pending > 0 },
            { label: m.kpiApproved, value: counts.approved, sub: m.kpiThisPage },
            { label: m.kpiRejected, value: counts.rejected, sub: m.kpiThisPage },
          ]}
        />
      </section>

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
            {totalLeads.toLocaleString(intlLocale(locale))} {m.tableTrailingCount}
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
          <ul className="divide-y divide-hairline">
            {rows.map((l) => (
              <li
                key={l.id}
                data-testid="broker-lead-row"
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_190px_minmax(0,0.8fr)_auto]"
              >
                <Avatar name={l.fullName} />

                {/* Client */}
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/broker-leads/${l.id}` as never}
                    data-testid="broker-lead-link"
                    className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700"
                  >
                    {l.fullName}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] tabular-nums text-slate-500">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span dir="ltr">{l.phone}</span>
                  </p>
                </div>

                {/* Broker */}
                <div className="hidden min-w-0 text-[12.5px] lg:block">
                  <Link
                    href={`/dashboard/brokers/${l.brokerId}` as never}
                    className="block truncate font-semibold text-slate-800 hover:text-brand-700"
                  >
                    {l.broker?.companyName ?? '—'}
                  </Link>
                  {l.brokerAgent && <p className="mt-0.5 truncate text-slate-500">{l.brokerAgent.fullName}</p>}
                </div>

                {/* Project */}
                <div className="hidden min-w-0 text-[12.5px] lg:block">
                  <p className="truncate font-semibold text-slate-800">
                    {l.projectInterest ? tx(l.projectInterest.name) : <span className="text-slate-400">—</span>}
                  </p>
                  {l.unitInterest && (
                    <p className="mt-0.5 text-slate-500">
                      <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                      <span className="whitespace-nowrap font-mono" dir="ltr">{l.unitInterest.code}</span>
                    </p>
                  )}
                </div>

                {/* Review status + stage */}
                <div className="hidden items-center gap-1.5 lg:flex">
                  {l.brokerApprovalStatus && (
                    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold', REVIEW_CHIP[l.brokerApprovalStatus])}>
                      {reviewLabel[l.brokerApprovalStatus]}
                    </span>
                  )}
                  <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold', STAGE_CHIP[l.stage])}>
                    {stageLabel[l.stage]}
                  </span>
                </div>

                {/* Assigned sales + date */}
                <div className="hidden min-w-0 text-[12.5px] lg:block">
                  <p className={cn('truncate font-semibold', l.assignedSales ? 'text-slate-800' : 'text-slate-400')}>
                    {l.assignedSales ? l.assignedSales.fullName : m.unassigned}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-slate-500">{formatDate(l.brokerSubmittedAt ?? l.createdAt, locale)}</p>
                </div>

                <Link
                  href={`/dashboard/broker-leads/${l.id}` as never}
                  aria-label={m.actionView}
                  title={m.actionView}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
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
