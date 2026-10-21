import Link from 'next/link';
import { BadgePercent, Eye, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, brokerOptions } from '@/lib/options';
import type { AdminBrokerCommission, Paged } from '@/lib/types';
import { tx, formatDate, formatCurrency, intlLocale, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Amount, FigureBar } from '@/components/cockpit/cockpit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
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
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerCommissionsPage;

  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const word = (ar: string, en: string) => (locale === 'en' ? en : ar);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of ['brokerId', 'status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerCommission>>(`/broker-commissions?${qs.toString()}`)),
    safe(brokerOptions()),
    safe(projectOptions()),
  ]);

  const paged = commRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  // Page-scoped financial totals
  const totalNet = rows.reduce((acc, r) => acc + Number(r.netAmount ?? 0), 0);
  const totalGross = rows.reduce((acc, r) => acc + Number(r.grossAmount ?? 0), 0);

  const totalCommissions = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.projectId || sp.from || sp.to);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      projectId: sp.projectId,
      from: sp.from,
      to: sp.to,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-commissions${q ? `?${q}` : ''}`;
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
            { label: m.kpiTotal, value: totalCommissions },
            { label: m.kpiPending, value: counts.pending, sub: m.kpiThisPage, warn: counts.pending > 0 },
            { label: m.kpiApproved, value: counts.approved, sub: m.kpiThisPage },
            { label: m.kpiNetTotal, value: totalNet > 0 ? <Amount parts={compactParts(totalNet, symbol, locale)} /> : '—', sub: m.kpiThisPage },
          ]}
        />
      </section>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {commRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorLoad}{commRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-commissions">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status    && <input type="hidden" name="status"    value={sp.status} />}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.from      && <input type="hidden" name="from"      value={sp.from} />}
        {!showFilters && sp.to        && <input type="hidden" name="to"        value={sp.to} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label={m.filterBrokerLabel} htmlFor="bcom-broker">
          <Select id="bcom-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
            <option value="">{m.filterAllBrokers}</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Action buttons — BEFORE the basis-full panel so ms-auto keeps them in row 1 */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
          {hasAnyFilter && (
            <Link href={'/dashboard/broker-commissions' as never}>
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
                <label htmlFor="bcom-status" className="text-[11px] font-medium text-slate-400">{m.filterStatus}</label>
                <Select id="bcom-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">{m.filterAllStatuses}</option>
                  <option value="PENDING">{m.filterStatusPending}</option>
                  <option value="APPROVED">{m.filterStatusApproved}</option>
                  <option value="REJECTED">{m.filterStatusRejected}</option>
                  <option value="CANCELLED">{m.filterStatusCancelled}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-project" className="text-[11px] font-medium text-slate-400">{m.filterProject}</label>
                <Select id="bcom-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">{m.filterAllProjects}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-from" className="text-[11px] font-medium text-slate-400">{m.filterDateFrom}</label>
                <Input id="bcom-from" name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-to" className="text-[11px] font-medium text-slate-400">{m.filterDateTo}</label>
                <Input id="bcom-to" name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Commissions table ────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<BadgePercent />}
        title={m.tableTitle}
        description={m.tableDescription}
        padded={false}
        trailing={
          totalGross > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
              {m.tableTrailingNet}{formatCurrency(totalNet, currency, locale)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 tabular-nums">
              {totalCommissions.toLocaleString(intlLocale(locale))} {m.tableTrailingCount}
            </span>
          )
        }
      >
        {rows.length === 0 && !commRes.error ? (
          <PremiumEmptyState
            icon={<BadgePercent />}
            title={m.emptyTitle}
            description={m.emptyDescription}
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((c) => (
              <li
                key={c.id}
                data-testid="commission-row"
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_290px_auto]"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                  <BadgePercent className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0">
                  {c.broker ? (
                    <Link href={`/dashboard/brokers/${c.broker.id}` as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {c.broker.companyName}
                    </Link>
                  ) : (
                    <p className="text-[14.5px] font-bold text-slate-400">—</p>
                  )}
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    <span className="me-1 text-slate-400">{word('عمولة', 'Commission')}</span>
                    <span className="whitespace-nowrap font-mono" dir="ltr">{c.commissionNumber}</span>
                    {c.brokerAgent && <span className="ms-1.5">· {c.brokerAgent.fullName}</span>}
                  </p>
                </div>

                <div className="hidden min-w-0 text-[12.5px] lg:block">
                  <p className="truncate font-semibold text-slate-800">{c.project ? tx(c.project.name) : '—'}</p>
                  <p className="mt-0.5 flex flex-col text-[12px] text-slate-500">
                    {c.unit?.code && (
                      <span className="whitespace-nowrap">
                        <span className="me-1 text-slate-400">{word('وحدة', 'Unit')}</span>
                        <span className="font-mono" dir="ltr">{c.unit.code}</span>
                      </span>
                    )}
                    <span className="whitespace-nowrap">
                      <span className="me-1 text-slate-400">{word('عقد', 'Contract')}</span>
                      <Link href={`/dashboard/contracts/${c.contractId}` as never} className="font-mono hover:text-brand-700" dir="ltr">
                        {c.contract?.contractNumber ?? '—'}
                      </Link>
                    </span>
                  </p>
                </div>

                <div className="hidden text-[12.5px] lg:block">
                  <p className="text-[11px] text-slate-500">{m.colDueDate}</p>
                  <p className="font-semibold text-slate-800">{formatDate(c.earnedAt, locale)}</p>
                </div>

                <div className="flex items-center gap-3 justify-self-end">
                  <BrokerCommissionStatusBadge status={c.status} locale={locale} />
                  <div className="text-end">
                    <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(c.netAmount, currency, locale)}</p>
                    <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
                      {c.commissionPct != null ? `${Number(c.commissionPct).toFixed(2)}% · ` : ''}
                      {word('من', 'of')} {formatCurrency(c.basisAmount, currency, locale)}
                    </p>
                    {Number(c.grossAmount) !== Number(c.netAmount) && (
                      <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">{m.colGross} {formatCurrency(c.grossAmount, currency, locale)}</p>
                    )}
                  </div>
                </div>

                <Link
                  href={`/dashboard/broker-commissions/${c.id}` as never}
                  aria-label={m.actionView}
                  title={m.actionView}
                  className="hidden h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900 lg:inline-flex"
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
          basePath="/dashboard/broker-commissions"
          params={{
            brokerId: sp.brokerId,
            status: sp.status,
            projectId: sp.projectId,
            from: sp.from,
            to: sp.to,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
