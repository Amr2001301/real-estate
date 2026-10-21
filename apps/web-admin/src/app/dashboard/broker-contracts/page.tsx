import Link from 'next/link';
import { FileText, Eye, CheckCircle2, ArrowRightLeft, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { projectOptions, brokerOptions, staffOptions } from '@/lib/options';
import type { AdminBrokerContract, Paged } from '@/lib/types';
import { tx, formatDate, formatCurrency, intlLocale, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Amount, Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  projectId?: string;
  salesId?: string;
  signed?: string;
  dateFrom?: string;
  dateTo?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerContractsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerContractsPage;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of ['brokerId', 'projectId', 'salesId', 'signed', 'dateFrom', 'dateTo'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [contractsRes, brokersRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerContract>>(`/broker-contracts?${qs.toString()}`)),
    safe(brokerOptions()),
    safe(projectOptions()),
    safe(staffOptions(['SALES', 'SALES_MANAGER'])),
  ]);

  const paged = contractsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    signed: rows.filter((r) => r.signedAt).length,
    pending: rows.filter((r) => !r.signedAt).length,
  };

  // Page-scoped financial totals (safely derived from already-fetched rows)
  const totalValue = rows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);
  const totalCommission = rows.reduce(
    (acc, r) => acc + Number(r.reservation?.commissionLockedAmount ?? 0),
    0,
  );

  const totalContracts = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.projectId || sp.salesId || sp.signed || sp.dateFrom || sp.dateTo);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      projectId: sp.projectId,
      salesId: sp.salesId,
      signed: sp.signed,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-contracts${q ? `?${q}` : ''}`;
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
        actions={
          <Link href={'/dashboard/broker-reservations?status=APPROVED' as never}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<ArrowRightLeft className="h-4 w-4" />}
            >
              {m.convertBtn}
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.kpiTotal, value: totalContracts },
            { label: m.kpiSigned, value: counts.signed, sub: m.kpiThisPage },
            { label: m.kpiPending, value: counts.pending, sub: m.kpiThisPage, warn: counts.pending > 0 },
            { label: m.kpiTotalValue, value: totalValue > 0 ? <Amount parts={compactParts(totalValue, symbol, locale)} /> : '—', sub: m.kpiThisPage },
          ]}
        />
      </section>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {contractsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorLoad}{contractsRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-contracts">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.salesId   && <input type="hidden" name="salesId"   value={sp.salesId} />}
        {!showFilters && sp.signed    && <input type="hidden" name="signed"    value={sp.signed} />}
        {!showFilters && sp.dateFrom  && <input type="hidden" name="dateFrom"  value={sp.dateFrom} />}
        {!showFilters && sp.dateTo    && <input type="hidden" name="dateTo"    value={sp.dateTo} />}

        {/* ── Row 1: main filter + actions (always visible) ─────────────────── */}
        <PremiumFilterField label={m.filterBrokerLabel} htmlFor="bc-broker">
          <Select id="bc-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
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
            <Link href={'/dashboard/broker-contracts' as never}>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-project" className="text-[11px] font-medium text-slate-400">{m.filterProject}</label>
                <Select id="bc-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">{m.filterAllProjects}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-sales" className="text-[11px] font-medium text-slate-400">{m.filterSalesRep}</label>
                <Select id="bc-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">{m.filterAllSalesReps}</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-signed" className="text-[11px] font-medium text-slate-400">{m.filterStatus}</label>
                <Select id="bc-signed" name="signed" inputSize="sm" defaultValue={sp.signed ?? ''}>
                  <option value="">{m.filterAllContracts}</option>
                  <option value="yes">{m.filterStatusSigned}</option>
                  <option value="no">{m.filterStatusPending}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-datefrom" className="text-[11px] font-medium text-slate-400">{m.filterDateFrom}</label>
                <Input id="bc-datefrom" name="dateFrom" inputSize="sm" type="date" defaultValue={sp.dateFrom ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-dateto" className="text-[11px] font-medium text-slate-400">{m.filterDateTo}</label>
                <Input id="bc-dateto" name="dateTo" inputSize="sm" type="date" defaultValue={sp.dateTo ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Contracts table ──────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<FileText />}
        title={m.tableTitle}
        description={m.tableDescription}
        padded={false}
        trailing={
          totalCommission > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
              {m.tableTrailingCommission}{formatCurrency(totalCommission, currency, locale)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 tabular-nums">
              {totalContracts.toLocaleString(intlLocale(locale))} {m.tableTrailingCount}
            </span>
          )
        }
      >
        {rows.length === 0 && !contractsRes.error ? (
          <PremiumEmptyState
            icon={<FileText />}
            title={m.emptyTitle}
            description={m.emptyDescription}
            action={
              <Link href={'/dashboard/broker-reservations?status=APPROVED' as never}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ArrowRightLeft className="h-4 w-4" />}
                >
                  {m.emptyConvertBtn}
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((c) => {
              const name = c.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—';
              const phone = c.customer?.phone ?? c.reservation?.lead?.phone;
              const comm = c.brokerCommission;
              const pct = comm?.commissionPct ?? c.reservation?.commissionLockedPct;
              const amt = comm?.netAmount ?? c.reservation?.commissionLockedAmount;
              return (
                <li
                  key={c.id}
                  data-testid="broker-contract-row"
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px_120px_auto]"
                >
                  <Avatar name={name} />

                  {/* Customer + contract number */}
                  <div className="min-w-0">
                    <Link href={`/dashboard/contracts/${c.id}` as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                      {name}
                    </Link>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">
                      {c.contractNumber && (
                        <>
                          <span className="me-1 text-slate-400">{locale === 'en' ? 'Contract' : 'عقد'}</span>
                          <span className="whitespace-nowrap font-mono" dir="ltr">{c.contractNumber}</span>
                        </>
                      )}
                      {c.contractNumber && phone && <span className="mx-1.5 text-slate-300">·</span>}
                      {phone && <span className="whitespace-nowrap" dir="ltr">{phone}</span>}
                    </p>
                  </div>

                  {/* Broker + agent */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    {c.broker ? (
                      <Link href={`/dashboard/brokers/${c.broker.id}` as never} className="block truncate font-semibold text-slate-800 hover:text-brand-700">
                        {c.broker.companyName}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {c.brokerAgent && <p className="mt-0.5 truncate text-slate-500">{c.brokerAgent.fullName}</p>}
                    <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                      {m.colSalesRep}: <span className="text-slate-600">{c.reservation?.sales?.fullName ?? m.unassigned}</span>
                    </p>
                  </div>

                  {/* Unit + project */}
                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    <p className="truncate font-semibold text-slate-800">
                      {c.unit?.building ? tx(c.unit.building.phase.project.name) : '—'}
                    </p>
                    {c.unit?.code && (
                      <p className="mt-0.5 truncate text-slate-500">
                        <span className="me-1 text-slate-400">{locale === 'en' ? 'Unit' : 'وحدة'}</span>
                        <span className="whitespace-nowrap font-mono" dir="ltr">{c.unit.code}</span>
                      </p>
                    )}
                  </div>

                  {/* Value + commission */}
                  <div className="hidden text-end lg:block">
                    <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(c.totalAmount, currency, locale)}</p>
                    <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">
                      {pct != null
                        ? `${Number(pct).toFixed(2)}%${amt != null ? ` · ${formatCurrency(amt, currency, locale)}` : ''}`
                        : amt != null
                          ? `${m.commissionFixed} · ${formatCurrency(amt, currency, locale)}`
                          : m.commissionUnset}
                    </p>
                  </div>

                  {/* Status + date */}
                  <div className="flex flex-col items-end gap-1 justify-self-end lg:items-start lg:justify-self-start">
                    {c.signedAt ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        {m.statusSigned}
                      </span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-600">
                        {m.statusPending}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-[11.5px] text-slate-500">{formatDate(c.createdAt, locale)}</span>
                  </div>

                  <Link
                    href={`/dashboard/contracts/${c.id}` as never}
                    aria-label={m.actionView}
                    title={m.actionView}
                    className="hidden h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900 lg:inline-flex"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paged && paged.meta.total > PAGE_SIZE && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/broker-contracts"
          params={{
            brokerId: sp.brokerId,
            projectId: sp.projectId,
            salesId: sp.salesId,
            signed: sp.signed,
            dateFrom: sp.dateFrom,
            dateTo: sp.dateTo,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
