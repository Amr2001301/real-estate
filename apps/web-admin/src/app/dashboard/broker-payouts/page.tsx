import Link from 'next/link';
import { Wallet, Plus, Eye, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { brokerOptions } from '@/lib/options';
import type { AdminBrokerPayout, Paged } from '@/lib/types';
import { formatDate, formatCurrency, intlLocale, compactParts } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { Amount, FigureBar } from '@/components/cockpit/cockpit';
import { periodLabel } from '../targets/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerPayoutStatusBadge } from '@/components/badges';
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
  period?: string;
  from?: string;
  to?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerPayoutsPage;

  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['brokerId', 'status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [payoutsRes, brokersRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerPayout>>(`/broker-payouts?${qs.toString()}`)),
    safe(brokerOptions()),
  ]);

  const paged = payoutsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    draft: rows.filter((r) => r.status === 'DRAFT').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    processing: rows.filter((r) => r.status === 'PROCESSING').length,
    paid: rows.filter((r) => r.status === 'PAID').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  // Page-scoped financial totals
  const totalNetPaid = rows
    .filter((r) => r.status === 'PAID')
    .reduce((acc, r) => acc + Number(r.totalNet ?? 0), 0);
  const totalNetPending = rows
    .filter((r) => r.status === 'APPROVED' || r.status === 'PROCESSING')
    .reduce((acc, r) => acc + Number(r.totalNet ?? 0), 0);

  const totalPayouts = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.period || sp.from || sp.to);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      period: sp.period,
      from: sp.from,
      to: sp.to,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-payouts${q ? `?${q}` : ''}`;
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
          <Link href={'/dashboard/broker-payouts/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.newPayoutBtn}
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
            { label: m.kpiTotal, value: totalPayouts },
            { label: m.kpiPaid, value: counts.paid, sub: m.kpiThisPage },
            { label: m.kpiTotalPaid, value: totalNetPaid > 0 ? <Amount parts={compactParts(totalNetPaid, symbol, locale)} /> : '—', sub: m.kpiThisPage },
            { label: m.kpiPending, value: totalNetPending > 0 ? <Amount parts={compactParts(totalNetPending, symbol, locale)} /> : '—', sub: m.kpiThisPage, warn: totalNetPending > 0 },
          ]}
        />
      </section>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {payoutsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.errorLoad}{payoutsRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-payouts">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status && <input type="hidden" name="status" value={sp.status} />}
        {!showFilters && sp.period && <input type="hidden" name="period" value={sp.period} />}
        {!showFilters && sp.from   && <input type="hidden" name="from"   value={sp.from} />}
        {!showFilters && sp.to     && <input type="hidden" name="to"     value={sp.to} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label={m.filterBrokerLabel} htmlFor="bpay-broker">
          <Select id="bpay-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
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
            <Link href={'/dashboard/broker-payouts' as never}>
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
                <label htmlFor="bpay-status" className="text-[11px] font-medium text-slate-400">{m.filterStatus}</label>
                <Select id="bpay-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">{m.filterAllStatuses}</option>
                  <option value="DRAFT">{m.filterStatusDraft}</option>
                  <option value="APPROVED">{m.filterStatusApproved}</option>
                  <option value="PROCESSING">{m.filterStatusProcessing}</option>
                  <option value="PAID">{m.filterStatusPaid}</option>
                  <option value="CANCELLED">{m.filterStatusCancelled}</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-period" className="text-[11px] font-medium text-slate-400">{m.filterPeriod}</label>
                <Input
                  id="bpay-period"
                  name="period"
                  inputSize="sm"
                  placeholder={m.filterPeriodPlaceholder}
                  dir="ltr"
                  defaultValue={sp.period ?? ''}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-from" className="text-[11px] font-medium text-slate-400">{m.filterDateFrom}</label>
                <Input id="bpay-from" name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-to" className="text-[11px] font-medium text-slate-400">{m.filterDateTo}</label>
                <Input id="bpay-to" name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Payouts table ────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<Wallet />}
        title={m.tableTitle}
        description={m.tableDescription}
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {totalPayouts.toLocaleString(intlLocale(locale))} {m.tableTrailingCount}
          </span>
        }
      >
        {rows.length === 0 && !payoutsRes.error ? (
          <PremiumEmptyState
            icon={<Wallet />}
            title={m.emptyTitle}
            description={m.emptyDescription}
            action={
              <Link href={'/dashboard/broker-payouts/new' as never}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  {m.emptyNewBtn}
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((p) => (
              <li
                key={p.id}
                data-testid="payout-row"
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_270px_auto]"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                  <Wallet className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0">
                  <Link href={`/dashboard/broker-payouts/${p.id}` as never} className="block truncate text-[14.5px] font-bold text-slate-900 hover:text-brand-700">
                    {p.broker?.companyName ?? '—'}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <span className="me-1 text-slate-400">{m.payoutWord}</span>
                    <span className="font-mono" dir="ltr">{p.payoutNumber}</span>
                  </p>
                </div>

                <div className="hidden text-[12.5px] lg:block">
                  <p className="text-[11px] text-slate-500">{m.colPeriod}</p>
                  <p className="font-semibold text-slate-800">{p.period ? periodLabel(p.period, locale) : m.periodUnset}</p>
                </div>

                <div className="hidden text-[12.5px] lg:block">
                  <p className="text-[11px] text-slate-500">{p.paidAt ? m.colPaidAt : m.colCreatedAt}</p>
                  <p className="font-semibold text-slate-800">{formatDate(p.paidAt ?? p.createdAt, locale)}</p>
                </div>

                <div className="flex items-center gap-3 justify-self-end">
                  <BrokerPayoutStatusBadge status={p.status} locale={locale} />
                  <div className="text-end">
                    <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(p.totalNet, currency, locale)}</p>
                    {Number(p.totalGross) !== Number(p.totalNet) && (
                      <p className="whitespace-nowrap text-[11.5px] tabular-nums text-slate-500">{m.colGross} {formatCurrency(p.totalGross, currency, locale)}</p>
                    )}
                  </div>
                </div>

                <Link
                  href={`/dashboard/broker-payouts/${p.id}` as never}
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
          basePath="/dashboard/broker-payouts"
          params={{
            brokerId: sp.brokerId,
            status: sp.status,
            period: sp.period,
            from: sp.from,
            to: sp.to,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
