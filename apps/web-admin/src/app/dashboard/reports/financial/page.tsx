import Link from 'next/link';
import { DepositStateChip } from '@/components/payments/payment-state';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { projectOptions as fetchProjectOptions } from '@/lib/options';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type {
  FinancialDashboard,
  FinancialDepositRow,
  DepositType,
  PlanPaymentType,
  OutstandingRefunds,
} from '@/lib/types';
import { compactParts, formatCurrency, formatDate, tx, intlLocale } from '@/lib/format';
import { getReportsCurrency, getCompanyTimeZone, todayIn } from '@/lib/currency';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PremiumPageHero, PremiumPanel, PremiumEmptyNote } from '@/components/premium';
import { ExportMenu } from '@/components/export-menu';
import { ReportsTabs } from '../_components/reports-tabs';
import { FinancialFilterBar } from './_components/financial-filter-bar';
import { CashflowChart } from './_components/cashflow-chart';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Search params ─────────────────────────────────────────────────────────────
interface Search {
  mode?: string; month?: string; year?: string; quarter?: string;
  dateFrom?: string; dateTo?: string; compare?: string;
  projectId?: string; q?: string; type?: string; showFilters?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
}
function getDepositLabel(d: FinancialDepositRow): string {
  return d.contract?.customer?.fullName ?? d.reservation?.client?.fullName ?? d.reservation?.lead?.fullName ?? '—';
}
function getDepositUnit(d: FinancialDepositRow): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).financialReportsPage;

  const sp = await searchParams;
  const currency = await getReportsCurrency();
  // The company's today: its month is the default, a running period is capped at it.
  const today    = todayIn(await getCompanyTimeZone());
  const resolved = resolveReportDateRange(sp, today);
  const { dateFrom, dateTo, year, mode, month, quarter } = resolved;
  const compare  = (sp.compare ?? 'none') as CompareMode;
  const cmpRange = resolveComparisonDateRange(resolved, compare, today);

  const PAYMENT_TYPE_LABELS: Partial<Record<PlanPaymentType, string>> = m.paymentTypeLabels;
  const PAYMENT_TYPE_CLS: Partial<Record<PlanPaymentType, string>> = {
    RESERVATION: 'bg-indigo-500/12 text-indigo-600', DOWN_PAYMENT: 'bg-brand-500/15 text-brand-700',
    INSTALLMENT: 'bg-slate-500/10 text-slate-600',    FINAL_PAYMENT: 'bg-violet-500/12 text-violet-600',
    BOUNCE_PENALTY: 'bg-danger-500/12 text-danger-600', LATE_FEE: 'bg-danger-500/12 text-danger-600',
    TRANSFER_FEE: 'bg-slate-500/10 text-slate-600',
  };
  const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = m.depositTypeLabels;
  const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
    BOOKING_AMOUNT: 'bg-indigo-500/12 text-indigo-600', DOWN_PAYMENT: 'bg-brand-500/15 text-brand-700',
    INSTALLMENT:    'bg-slate-500/10 text-slate-600',    FINAL_PAYMENT: 'bg-violet-500/12 text-violet-600',
    FEE:            'bg-danger-500/12 text-danger-600',
  };

  function daysLabel(d: number): string {
    if (d === 0) return m.overdueTable.daysToday;
    if (d === 1) return m.overdueTable.daysOne;
    if (d <= 10) return m.overdueTable.daysShort(d);
    return m.overdueTable.daysLong(d);
  }

  function apiUrl(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/reports/financial-dashboard${qs ? `?${qs}` : ''}`;
  }

  const [dashRes, cmpDashRes, projectsRes, refundsRes] = await Promise.all([
    safe(api.get<FinancialDashboard>(apiUrl({ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }))),
    cmpRange
      // The same filters as the current period, only the dates differ.
      ? safe(api.get<FinancialDashboard>(apiUrl({ dateFrom: cmpRange.dateFrom, dateTo: cmpRange.dateTo, projectId: sp.projectId, q: sp.q, type: sp.type })))
      : Promise.resolve({ data: null, error: null }),
    safe(fetchProjectOptions()),
    safe(api.get<OutstandingRefunds>('/contracts/refunds/outstanding')),
  ]);
  const refundsOwedRows = refundsRes.data?.data ?? [];

  const dash     = dashRes.data;
  const s        = dash?.summary;
  const projects = projectsRes.data?.data ?? [];
  const cmpS     = cmpDashRes.data?.summary;

  // Primary financials
  const contractVal    = num(s?.totalContractValue);
  const outstanding    = num(s?.totalOutstanding     ?? s?.totalRemaining);
  const overdueAmt     = num(s?.overdueAmountComputed ?? s?.totalOverdue);
  const overdueCount   = s?.overdueInstallmentCountComputed ?? s?.overdueInstallmentCount ?? 0;
  const dueSoon        = num(s?.dueSoonAmount);
  const collectedMonth = num(s?.collectedThisMonth);
  const dueMonth       = num(s?.dueThisMonth);
  const contractCount  = s?.contractCount ?? 0;
  const depositCount   = s?.depositCount  ?? 0;
  const refundsPaid    = num(s?.refundsPaid);
  const refundsOwed    = num(s?.refundsOwed);
  const netCollected   = num(s?.netCollected ?? s?.totalCollectedVerified ?? s?.totalCollected);

  // Two figures (decided 2026-10-16): towards the price — the rate's
  // numerator, as on the dashboard — and fees & penalties.
  const towardsPrice   = num(s?.collectedTowardsPrice ?? s?.totalCollectedVerified ?? s?.totalCollected);
  const feesCollected  = num(s?.feesCollected);
  // The rate is collected against what is due by today (decided 2026-10-17),
  // as on the dashboard — it divided the period's money by every contract's
  // whole value. The overdue rate is the share of what is due left unpaid.
  const dueToDate      = num(s?.dueToDate);
  const againstDue     = num(s?.collectedAgainstDue ?? s?.collectedTowardsPrice);
  const collectionRate = dueToDate > 0 ? Math.min(100, Math.round((againstDue / dueToDate) * 100)) : 0;
  const overdueRate    = dueToDate > 0 ? parseFloat(((overdueAmt / dueToDate) * 100).toFixed(1)) : 0;
  const notYetDue      = Math.max(0, outstanding - overdueAmt);

  // Comparison deltas
  const contractDelta  = cmpS ? computeDelta(contractVal,   num(cmpS.totalContractValue))                         : undefined;
  const collectedDelta = cmpS
    ? computeDelta(towardsPrice, num(cmpS.collectedTowardsPrice ?? cmpS.totalCollectedVerified ?? cmpS.totalCollected))
    : undefined;
  const outstandDelta  = cmpS ? computeDelta(outstanding,   num(cmpS.totalOutstanding ?? cmpS.totalRemaining))    : undefined;
  const overdueDelta   = cmpS ? computeDelta(overdueAmt,    num(cmpS.overdueAmountComputed ?? cmpS.totalOverdue)) : undefined;

  const aging    = dash?.aging   ?? [];
  const forecast = dash?.cashflowForecast;

  const showFilters = !!(sp.q || sp.type || sp.projectId || sp.showFilters === '1');
  const projectOptions = projects.map((p) => ({ id: p.id, name: tx(p.name) }));

  // The currency's own sign ("ج.م." / "EGP"), for amounts set as number + unit.
  const currencySign =
    new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  const money = (n: number | string) => formatCurrency(n, currency, locale);
  const short = (n: number) => compactParts(n, '', locale).join(' ').trim();
  const count = (n: number) => n.toLocaleString(intlLocale(locale));

  const forecastTotal = forecast ? forecast.next30 + forecast.next3160 + forecast.next6190 : 0;
  const agingTotal = aging.reduce((sum, b) => sum + num(b.amount), 0);
  const overdueRows = dash?.overdue ?? [];
  const allClear = !!dash && overdueAmt === 0 && overdueRows.length === 0;
  const byType = (dash?.collectionByType ?? []).filter((c) => c.count > 0 || num(c.totalAll) > 0);
  const byTypeMax = Math.max(1, ...byType.map((c) => num(c.totalAll)));
  const share = (n: number) => (contractVal > 0 ? (n / contractVal) * 100 : 0);
  const rateTone = collectionRate >= 75 ? 'good' : collectionRate >= 40 ? 'mid' : 'low';

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumbReports, href: '/dashboard/reports' },
          { label: m.breadcrumbSelf },
        ]}
        actions={
          <ExportMenu locale={locale}
            label={m.exportBtn}
            pdfPath="/reports/financial-dashboard/export.pdf"
            xlsxPath="/reports/financial-dashboard/export.xlsx"
            csvPath="/reports/financial-dashboard/export.csv"
            filenameBase="financial-dashboard"
            params={{ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }}
          />
        }
      />

      <ReportsTabs active="financial" locale={locale} />
      <FinancialFilterBar
        defaultMode={mode as PeriodMode}
        defaultMonth={month}
        defaultYear={year}
        defaultQuarter={quarter}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        defaultCompare={compare}
        defaultProjectId={sp.projectId ?? ''}
        defaultQ={sp.q ?? ''}
        defaultType={sp.type ?? ''}
        defaultShowFilters={showFilters}
        projects={projectOptions}
        locale={locale}
      />

      {dashRes.error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">
          {dashRes.error}
        </div>
      )}

      {/* ─── Hero: what came in, the rate, the months ───────────────────── */}
      <section data-testid="fin-hero" className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.09] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -top-24 start-1/3 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-10">
          <div className="flex flex-col justify-between gap-7">
            <div>
              <p className="text-[13px] font-semibold text-slate-500">{m.kpi.collected}</p>
              <div className="mt-2" data-testid="fin-collected">
                <Amount value={towardsPrice} sign={currencySign} locale={locale} size="hero" />
              </div>
              {collectedDelta && <DeltaChip delta={collectedDelta} label={m.hero.vsCompare} />}
            </div>

            <div className="flex items-center gap-5">
              <RateRing rate={collectionRate} tone={rateTone} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900">{m.hero.rate}</p>
                <p className="mt-0.5 text-[12px] text-slate-500">{m.hero.rateSub}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                  <span className="text-slate-500">
                    {m.collectionEfficiency.overdueLabel}{' '}
                    <b className={cn('tabular-nums', overdueRate > 0 ? 'text-danger-600' : 'text-slate-700')}>{overdueRate}%</b>
                  </span>
                  <span className="text-slate-500">
                    {m.collectionEfficiency.remainingLabel}{' '}
                    <b className="text-slate-700 tabular-nums">{dueToDate > 0 ? 100 - collectionRate : 0}%</b>
                  </span>
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-4 border-t border-hairline pt-5">
              {[
                { label: m.kpi.collectedMonth, value: money(collectedMonth) },
                { label: m.kpi.dueMonth,       value: money(dueMonth) },
                { label: m.hero.fees,          value: money(feesCollected) },
              ].map((x) => (
                <div key={x.label} className="min-w-0">
                  <dt className="truncate text-[11px] font-medium text-slate-500" title={x.label}>{x.label}</dt>
                  <dd className="mt-1 truncate text-[14px] font-bold text-slate-900 tabular-nums" title={x.value}>{x.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-[17px] font-bold text-slate-900">{m.cashflow.title}</p>
                <p className="mt-0.5 text-[12px] text-slate-500">{m.cashflow.description}</p>
              </div>
              <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />{m.cashflow.legendCollected}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400/40" />{m.cashflow.legendDue}</span>
              </div>
            </div>
            {(dash?.cashflowTrend ?? []).some((d) => d.collected > 0 || d.due > 0) ? (
              <CashflowChart
                data={dash!.cashflowTrend}
                labels={{ collected: m.cashflow.legendCollected, due: m.cashflow.legendDue }}
                money={money}
                short={short}
              />
            ) : (
              <PremiumEmptyNote>{m.cashflow.emptyMsg}</PremiumEmptyNote>
            )}
          </div>
        </div>
      </section>

      {/* ─── Key figures ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FigureCard
          testId="fin-kpi-contracts"
          icon={<FileText />}
          label={m.kpi.contractValue}
          value={<Amount value={contractVal} sign={currencySign} locale={locale} />}
          sub={m.kpi.contractValueSub(contractCount, depositCount)}
          delta={contractDelta}
        />
        <FigureCard
          testId="fin-kpi-outstanding"
          icon={<Clock />}
          label={m.kpi.outstanding}
          value={<Amount value={outstanding} sign={currencySign} locale={locale} />}
          sub={m.kpi.outstandingSub(money(dueSoon))}
          delta={outstandDelta}
          upIsBad
        />
        <FigureCard
          testId="fin-kpi-overdue"
          icon={<AlertTriangle />}
          tone={overdueAmt > 0 ? 'warn' : 'good'}
          label={m.kpi.overdue}
          value={<Amount value={overdueAmt} sign={currencySign} locale={locale} />}
          sub={m.kpi.overdueSub(overdueCount, overdueRate)}
          delta={overdueDelta}
          upIsBad
        />
      </div>

      {/* ─── Refunds (only when there are any) ─────────────────────────── */}
      {(refundsPaid > 0 || refundsOwed > 0 || refundsOwedRows.length > 0) && (
        <PremiumPanel title={m.refundsTitle} sub={m.refundsOwed.title} padding="none">
          <dl className="grid grid-cols-1 gap-px border-y border-hairline bg-hairline sm:grid-cols-3">
            {[
              { label: m.kpi.netCollected, value: money(netCollected), cls: 'text-emerald-600' },
              { label: m.kpi.refundsPaid,  value: money(refundsPaid),  cls: 'text-slate-900' },
              { label: m.kpi.refundsOwed,  value: money(refundsOwed),  cls: refundsOwed > 0 ? 'text-amber-600' : 'text-slate-900' },
            ].map((x) => (
              <div key={x.label} className="bg-surface px-6 py-4">
                <dt className="text-[12px] text-slate-500">{x.label}</dt>
                <dd className={cn('mt-1 text-[18px] font-bold tabular-nums', x.cls)}>{x.value}</dd>
              </div>
            ))}
          </dl>
          {refundsOwedRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]" data-testid="refunds-owed">
                <thead>
                  <tr className="text-[11.5px] text-slate-500">
                    <th className="px-6 py-3 text-start font-semibold">{m.refundsOwed.contract}</th>
                    <th className="px-4 py-3 text-start font-semibold">{m.refundsOwed.customer}</th>
                    <th className="px-4 py-3 text-end font-semibold">{m.refundsOwed.agreed}</th>
                    <th className="px-4 py-3 text-end font-semibold">{m.refundsOwed.paid}</th>
                    <th className="px-6 py-3 text-end font-semibold">{m.refundsOwed.owed}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline border-t border-hairline">
                  {refundsOwedRows.map((r) => (
                    <tr key={r.contractId} className="transition-colors hover:bg-surface-muted/50">
                      <td className="px-6 py-3">
                        <Link href={`/dashboard/contracts/${r.contractId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                          {r.contractNumber ?? r.contractId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.customer?.fullName ?? '—'}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{money(r.refundAmount)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{money(r.refunded)}</td>
                      <td className="px-6 py-3 text-end font-bold tabular-nums text-amber-600">{money(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumPanel>
      )}

      {/* ─── Contract value + what is coming ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
        <PremiumPanel className="lg:col-span-3" title={m.distribution.title} sub={m.distribution.description} bodyClassName="flex flex-col justify-center">
          <div className="flex flex-col gap-5" data-testid="fin-distribution">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted">
              <span className="h-full bg-emerald-500" style={{ width: `${share(towardsPrice)}%` }} />
              <span className="h-full bg-danger-500" style={{ width: `${share(overdueAmt)}%` }} />
              <span className="h-full bg-slate-400/40" style={{ width: `${share(notYetDue)}%` }} />
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: m.distribution.rows.contractValue, amount: contractVal,  dot: 'bg-brand-500',    pct: contractVal > 0 ? 100 : 0 },
                // Each a share of the value: collected, overdue, and not yet due
                // (outstanding already holds the overdue — they summed past 100%).
                { label: m.distribution.rows.collected,     amount: towardsPrice, dot: 'bg-emerald-500',  pct: share(towardsPrice) },
                { label: m.distribution.rows.overdue,       amount: overdueAmt,   dot: 'bg-danger-500',   pct: share(overdueAmt) },
                { label: m.distribution.rows.outstanding,   amount: notYetDue,    dot: 'bg-slate-400/60', pct: share(notYetDue) },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-3 rounded-2xl border border-hairline px-4 py-3">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', r.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-slate-500">{r.label}</span>
                    <span className="block truncate text-[15px] font-bold text-slate-900 tabular-nums">{money(r.amount)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-slate-400 tabular-nums">{r.pct.toFixed(r.pct === 100 || r.pct === 0 ? 0 : 1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </PremiumPanel>

        <PremiumPanel className="lg:col-span-2" title={m.forecast.title} sub={m.forecast.description} bodyClassName="flex flex-col justify-center">
          {forecast && forecastTotal > 0 ? (
            <ol className="flex flex-col gap-4" data-testid="fin-forecast">
              {[
                { label: m.forecast.next30,   amount: forecast.next30,   bar: 'bg-brand-500' },
                { label: m.forecast.next3160, amount: forecast.next3160, bar: 'bg-brand-400/70' },
                { label: m.forecast.next6190, amount: forecast.next6190, bar: 'bg-brand-300/50' },
              ].map((b) => {
                const pct = Math.round((b.amount / forecastTotal) * 100);
                return (
                  <li key={b.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] font-medium text-slate-500">{b.label}</span>
                      <span className="text-[15px] font-bold text-slate-900 tabular-nums">{money(b.amount)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className={cn('h-full rounded-full', b.bar)} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{m.forecast.pctOfTotal(pct)}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <PremiumEmptyNote>{m.forecast.empty}</PremiumEmptyNote>
          )}
        </PremiumPanel>
      </div>

      {/* ─── Overdue: one calm line when clear, the detail when not ────── */}
      {allClear ? (
        <div
          data-testid="fin-all-clear"
          className="flex items-center gap-4 rounded-[22px] border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-5"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-[17px] font-bold text-slate-900">{m.attention.allClear}</p>
            <p className="mt-0.5 text-[13px] text-slate-500">{m.attention.allClearSub}</p>
          </div>
        </div>
      ) : (
        <PremiumPanel
          title={m.overdueTable.title}
          sub={overdueCount > 0 ? m.overdueTable.overdueSuffix(overdueCount) : undefined}
          link={{ href: '/dashboard/deposits', label: m.overdueTable.viewAll }}
          padding="none"
        >
          {aging.length > 0 && (
            <div className="grid grid-cols-2 gap-px border-y border-hairline bg-hairline lg:grid-cols-4" data-testid="fin-aging">
              {aging.map((b) => {
                const amt = num(b.amount);
                const late = b.label === '90+' || b.label === '61-90';
                return (
                  <div key={b.label} className="bg-surface px-6 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium text-slate-500">{m.aging.labels[b.label as keyof typeof m.aging.labels] ?? b.label}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums',
                        b.count === 0 ? 'bg-surface-muted text-slate-400' : late ? 'bg-danger-500/12 text-danger-600' : 'bg-amber-500/15 text-amber-600',
                      )}>
                        {count(b.count)}
                      </span>
                    </div>
                    <p className={cn('mt-2 text-[17px] font-bold tabular-nums', b.count === 0 ? 'text-slate-400' : late ? 'text-danger-600' : 'text-amber-600')}>
                      {money(amt)}
                    </p>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className={cn('h-full rounded-full', late ? 'bg-danger-500' : 'bg-amber-400')} style={{ width: `${agingTotal > 0 ? (amt / agingTotal) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {overdueRows.length === 0 ? (
            <div className="px-6 py-6">
              <PremiumEmptyNote>{m.overdueTable.emptyTitle}</PremiumEmptyNote>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="text-[11.5px] text-slate-500">
                    <th className="py-3 ps-6 pe-4 text-start font-semibold">{m.overdueTable.cols.client}</th>
                    <th className="px-4 py-3 text-start font-semibold">{m.overdueTable.cols.contract}</th>
                    <th className="px-4 py-3 text-start font-semibold">{m.overdueTable.cols.unit}</th>
                    <th className="px-4 py-3 text-start font-semibold">{m.overdueTable.cols.type}</th>
                    <th className="px-4 py-3 text-start font-semibold">{m.overdueTable.cols.dueDate}</th>
                    <th className="px-4 py-3 text-end font-semibold">{m.overdueTable.cols.amount}</th>
                    <th className="py-3 ps-4 pe-6 text-start font-semibold">{m.overdueTable.cols.delay}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline border-t border-hairline">
                  {overdueRows.map((row) => {
                    const c    = row.plan.contract;
                    const days = daysOverdue(row.dueDate);
                    return (
                      <tr key={row.id} className="align-middle transition-colors hover:bg-surface-muted/50">
                        <td className="max-w-[180px] truncate py-3 ps-6 pe-4 font-semibold text-slate-900">{c.customer.fullName}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link href={`/dashboard/contracts/${c.id}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                            {c.contractNumber ?? `#${c.id.slice(0, 8)}`}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-slate-500">{c.unit.code}</td>
                        <td className="px-4 py-3">
                          <TypeChip cls={PAYMENT_TYPE_CLS[row.type]}>{PAYMENT_TYPE_LABELS[row.type] ?? row.type}</TypeChip>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-500 tabular-nums">{formatDate(row.dueDate, locale)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-end font-bold text-slate-900 tabular-nums">{money(row.amount)}</td>
                        <td className="whitespace-nowrap py-3 ps-4 pe-6">
                          <span className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                            days > 30 ? 'bg-danger-500/12 text-danger-600' : 'bg-amber-500/15 text-amber-600',
                          )}>
                            {daysLabel(days)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PremiumPanel>
      )}

      {/* ─── Upcoming + by payment type ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <PremiumPanel title={m.upcoming.title} sub={m.upcoming.sub}>
          <div className="flex flex-col gap-5" data-testid="fin-upcoming">
            {[
              { title: m.upcoming.thisWeekTitle,  rows: dash?.upcomingThisWeek  ?? [], empty: m.upcoming.thisWeekEmpty },
              { title: m.upcoming.thisMonthTitle, rows: dash?.upcomingThisMonth ?? [], empty: m.upcoming.thisMonthEmpty },
            ].map((group) => (
              <div key={group.title}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[12.5px] font-bold text-slate-700">{group.title}</p>
                  {group.rows.length > 0 && (
                    <span className="text-[12.5px] font-bold text-brand-700 tabular-nums">
                      {money(group.rows.reduce((sum, r) => sum + num(r.amount), 0))}
                    </span>
                  )}
                </div>
                {group.rows.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-2xl border border-dashed border-hairline px-4 py-3 text-[12.5px] text-slate-500">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    {group.empty}
                  </p>
                ) : (
                  <ul className="divide-y divide-hairline rounded-2xl border border-hairline">
                    {group.rows.map((row) => (
                      <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-20 shrink-0 text-[11.5px] text-slate-500 tabular-nums">{formatDate(row.dueDate, locale)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{row.plan.contract.customer.fullName}</span>
                        <span className="shrink-0 text-[13px] font-bold text-slate-900 tabular-nums">{money(row.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </PremiumPanel>

        <PremiumPanel title={m.collectionByType.title} sub={m.collectionByType.description} bodyClassName="flex flex-col justify-center">
          {byType.length === 0 ? (
            <PremiumEmptyNote>{m.collectionByType.empty}</PremiumEmptyNote>
          ) : (
            <ul className="flex flex-col gap-4" data-testid="fin-by-type">
              {byType.map((c) => {
                const all = num(c.totalAll);
                const collected = num(c.totalCollected);
                const awaiting = num(c.totalAwaiting);
                return (
                  <li key={c.type}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <TypeChip cls={DEPOSIT_TYPE_CLS[c.type]}>{DEPOSIT_TYPE_LABELS[c.type] ?? c.type}</TypeChip>
                        <span className="text-[11.5px] text-slate-400 tabular-nums">{count(c.count)} {m.collectionByType.depositSuffix}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-bold text-slate-900 tabular-nums">{money(all)}</span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-muted">
                      <span className="h-full bg-emerald-500" style={{ width: `${(collected / byTypeMax) * 100}%` }} />
                      <span className="h-full bg-amber-400" style={{ width: `${(awaiting / byTypeMax) * 100}%` }} />
                    </div>
                    {awaiting > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {m.collectionByType.colCollected} <b className="text-emerald-600 tabular-nums">{money(collected)}</b>
                        {' · '}
                        {m.collectionByType.colAwaiting} <b className="text-amber-600 tabular-nums">{money(awaiting)}</b>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PremiumPanel>
      </div>

      {/* ─── Bookings + liabilities ────────────────────────────────────── */}
      {(dash?.booking || dash?.liabilities) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {dash?.booking && (
            <PremiumPanel title={m.booking.title} sub={m.booking.description} padding="none" bodyClassName="flex flex-col">
              <ul className="flex flex-1 flex-col divide-y divide-hairline border-t border-hairline">
                {[
                  { label: m.booking.pendingReservations,  n: dash.booking.pendingReservationsCount,  value: dash.booking.pendingReservationsBookingAmount,  cls: 'text-amber-600' },
                  { label: m.booking.approvedReservations, n: dash.booking.approvedReservationsCount, value: dash.booking.approvedReservationsBookingAmount, cls: 'text-slate-900' },
                  { label: m.booking.bookingCollected,     value: dash.booking.bookingCollectedVerified,   cls: 'text-emerald-600' },
                  { label: m.booking.bookingUncollected,   value: dash.booking.bookingUncollectedEstimate, cls: 'text-slate-700' },
                ].map((row) => (
                  <li key={row.label} className="flex flex-1 items-center gap-3 px-6 py-3.5">
                    <span className="min-w-0 flex-1 text-[13px] text-slate-600">{row.label}</span>
                    {'n' in row && row.n !== undefined && (
                      <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                        {m.booking.count(row.n)}
                      </span>
                    )}
                    <span className={cn('shrink-0 text-[14px] font-bold tabular-nums', row.cls)}>{money(row.value)}</span>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
          )}

          {dash?.liabilities && (
            <PremiumPanel title={m.liabilities.title} sub={m.liabilities.description} padding="none">
              <div className="flex items-baseline justify-between gap-3 border-t border-hairline bg-danger-500/[0.04] px-6 py-4">
                <span className="text-[13px] font-semibold text-slate-700">{m.liabilities.total}</span>
                <span className={cn('text-[19px] font-bold tabular-nums', num(dash.liabilities.totalUnpaidLiabilities) > 0 ? 'text-danger-600' : 'text-slate-900')}>
                  {money(dash.liabilities.totalUnpaidLiabilities)}
                </span>
              </div>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {[
                  { label: m.liabilities.salesBonus,        value: money(dash.liabilities.salesBonus.unpaidAmount),        cls: 'text-amber-600' },
                  { label: m.liabilities.brokerCommissions, value: money(dash.liabilities.brokerCommissions.unpaidAmount), cls: 'text-amber-600' },
                  { label: m.liabilities.paid,              value: money(num(dash.liabilities.salesBonus.paidAmount) + num(dash.liabilities.brokerCommissions.paidAmount)), cls: 'text-emerald-600' },
                  // Paid out on deals since cancelled, and not recovered yet.
                  { label: m.liabilities.clawbacksOwed,     value: money(dash.liabilities.clawbacksOwed?.totalAmount ?? 0), cls: 'text-brand-700', testId: 'clawbacks-owed' },
                ].map((row) => (
                  <li key={row.label} data-testid={'testId' in row ? row.testId : undefined} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <span className="text-[13px] text-slate-600">{row.label}</span>
                    <span className={cn('whitespace-nowrap text-[14px] font-bold tabular-nums', row.cls)}>{row.value}</span>
                  </li>
                ))}
              </ul>
            </PremiumPanel>
          )}
        </div>
      )}

      {/* ─── Recent payments ───────────────────────────────────────────── */}
      <PremiumPanel
        title={m.recentDeposits.title}
        sub={m.recentDeposits.description}
        link={{ href: '/dashboard/deposits', label: m.recentDeposits.viewAll }}
        padding="none"
      >
        {(!dash || dash.recentDeposits.length === 0) ? (
          <div className="px-6 pb-6">
            <PremiumEmptyNote>{m.recentDeposits.empty}</PremiumEmptyNote>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]" data-testid="fin-recent">
              <thead>
                <tr className="text-[11.5px] text-slate-500">
                  <th className="py-3 ps-6 pe-4 text-start font-semibold">{m.recentDeposits.cols.type}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.recentDeposits.cols.client}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.recentDeposits.cols.unit}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.recentDeposits.cols.ref}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.recentDeposits.cols.paidAt}</th>
                  <th className="px-4 py-3 text-end font-semibold">{m.recentDeposits.cols.amount}</th>
                  <th className="py-3 ps-4 pe-6 text-start font-semibold">{m.recentDeposits.cols.verified}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline border-t border-hairline">
                {dash.recentDeposits.slice(0, 10).map((d) => (
                  <tr key={d.id} className="align-middle transition-colors hover:bg-surface-muted/50">
                    <td className="whitespace-nowrap py-3 ps-6 pe-4">
                      <TypeChip cls={DEPOSIT_TYPE_CLS[d.type]}>{DEPOSIT_TYPE_LABELS[d.type] ?? d.type}</TypeChip>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-semibold text-slate-900">{getDepositLabel(d)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-slate-500">{getDepositUnit(d)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {d.contract ? (
                        <Link href={`/dashboard/contracts/${d.contract.id}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                          {d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8)}`}
                        </Link>
                      ) : d.reservation ? (
                        <Link href={`/dashboard/reservations/${d.reservation.id}`} className="font-mono text-[12px] text-indigo-600 hover:underline">
                          {d.reservation.reservationNumber ?? `#${d.reservation.id.slice(0, 8)}`}
                        </Link>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-500 tabular-nums">{formatDate(d.paidAt, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-end font-bold text-slate-900 tabular-nums">{money(d.amount)}</td>
                    <td className="whitespace-nowrap py-3 ps-4 pe-6">
                      <DepositStateChip state={d.state} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

/** An exact amount set as a large number with its currency in small gold. */
function Amount({ value, sign, locale, size = 'card' }: { value: number; sign: string; locale: Locale; size?: 'hero' | 'card' }) {
  const n = Math.round(value).toLocaleString(intlLocale(locale));
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" dir="ltr">
      {locale === 'en' && <span className={cn('font-bold text-brand-700', size === 'hero' ? 'text-[16px]' : 'text-[12px]')}>{sign}</span>}
      <span className={cn('num font-semibold leading-none text-slate-900', size === 'hero' ? 'text-[54px] tracking-tight' : 'text-[30px]')}>{n}</span>
      {locale !== 'en' && <span className={cn('font-bold text-brand-700', size === 'hero' ? 'text-[16px]' : 'text-[12px]')}>{sign}</span>}
    </span>
  );
}

type Delta = { value: string; direction: 'up' | 'down' | 'flat' };

function DeltaChip({ delta, label, upIsBad = false }: { delta: Delta; label?: string; upIsBad?: boolean }) {
  const good = delta.direction === 'flat' ? null : (delta.direction === 'up') !== upIsBad;
  return (
    <span
      className={cn(
        'mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
        good === true && 'bg-emerald-500/12 text-emerald-600',
        good === false && 'bg-danger-500/10 text-danger-600',
        good === null && 'bg-surface-muted text-slate-500',
      )}
    >
      {delta.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : delta.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      <span dir="ltr">{delta.value}</span>
      {label && <span className="font-medium opacity-80">{label}</span>}
    </span>
  );
}

/** The collection rate as a ring. */
function RateRing({ rate, tone }: { rate: number; tone: 'good' | 'mid' | 'low' }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[104px] w-[104px] shrink-0" data-testid="fin-rate">
      <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" strokeWidth="9" className="stroke-surface-muted" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, rate) / 100) * c} ${c}`}
          className={tone === 'good' ? 'stroke-emerald-500' : tone === 'mid' ? 'stroke-brand-500' : 'stroke-danger-500'}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="num text-[28px] font-semibold text-slate-900">{rate}<span className="text-[15px] text-slate-500">%</span></span>
      </span>
    </div>
  );
}

function FigureCard({
  icon, label, value, sub, delta, upIsBad, tone = 'neutral', testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: Delta;
  upIsBad?: boolean;
  tone?: 'neutral' | 'good' | 'warn';
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col gap-3 overflow-hidden rounded-[20px] border bg-surface p-5 transition-colors',
        tone === 'warn' ? 'border-danger-500/30' : tone === 'good' ? 'border-emerald-500/25' : 'border-hairline hover:border-brand-500/30',
      )}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
        <span className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
          tone === 'warn' ? 'bg-danger-500/12 text-danger-600' : tone === 'good' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-brand-500/12 text-brand-700',
        )}>
          {icon}
        </span>
        <span className="truncate" title={label}>{label}</span>
      </div>
      <div>{value}</div>
      <div className="flex flex-wrap items-center gap-2">
        {sub && <p className="text-[12px] text-slate-500">{sub}</p>}
        {delta && <DeltaChip delta={delta} upIsBad={upIsBad} />}
      </div>
    </div>
  );
}

function TypeChip({ cls, children }: { cls?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold', cls ?? 'bg-slate-500/10 text-slate-600')}>
      {children}
    </span>
  );
}
