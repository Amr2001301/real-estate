import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import type {
  FinancialDashboard,
  FinancialInstallmentRow,
  FinancialDepositRow,
  DepositType,
  PlanPaymentType,
  Paged,
} from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PageHeader } from '@/components/ui/page-header';
import { ExportMenu } from '@/components/export-menu';
import { ReportsTabs } from '../_components/reports-tabs';
import { FinancialFilterBar } from './_components/financial-filter-bar';
import { CashflowBarChart } from './_components/cashflow-bar-chart';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Search params ─────────────────────────────────────────────────────────────
interface Search {
  mode?: string; month?: string; year?: string; quarter?: string;
  dateFrom?: string; dateTo?: string; compare?: string;
  projectId?: string; q?: string; type?: string; showFilters?: string;
}
interface ProjectOption { id: string; name: { ar: string; en: string } }

// ── Label / tone maps ─────────────────────────────────────────────────────────
const PAYMENT_TYPE_LABELS: Record<PlanPaymentType, string> = {
  RESERVATION: 'مبلغ الحجز', DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',   FINAL_PAYMENT: 'دفعة أخيرة',
};
const PAYMENT_TYPE_CLS: Record<PlanPaymentType, string> = {
  RESERVATION: 'bg-indigo-100 text-indigo-700', DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',   FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};
const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز', DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',      FINAL_PAYMENT: 'دفعة أخيرة',
};
const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700', DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT:    'bg-slate-100 text-slate-600',    FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};
const AGING_LABELS: Record<string, string> = {
  '1-30': '1–30 يوم', '31-60': '31–60 يوم', '61-90': '61–90 يوم', '90+': '+90 يوم',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
}
function daysLabel(d: number): string {
  if (d === 0) return 'اليوم';
  if (d === 1) return 'يوم واحد';
  if (d <= 10) return `${d} أيام`;
  return `${d} يوم`;
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
  const sp = await searchParams;
  const resolved = resolveReportDateRange(sp);
  const { dateFrom, dateTo, year, mode, month, quarter } = resolved;
  const compare  = (sp.compare ?? 'none') as CompareMode;
  const cmpRange = resolveComparisonDateRange(resolved, compare);

  function apiUrl(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/reports/financial-dashboard${qs ? `?${qs}` : ''}`;
  }

  const [dashRes, cmpDashRes, projectsRes] = await Promise.all([
    safe(api.get<FinancialDashboard>(apiUrl({ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }))),
    cmpRange
      ? safe(api.get<FinancialDashboard>(apiUrl({ dateFrom: cmpRange.dateFrom, dateTo: cmpRange.dateTo, projectId: sp.projectId })))
      : Promise.resolve({ data: null, error: null }),
    safe(api.get<Paged<ProjectOption>>('/projects?pageSize=100')),
  ]);

  const dash     = dashRes.data;
  const s        = dash?.summary;
  const projects = projectsRes.data?.data ?? [];
  const cmpS     = cmpDashRes.data?.summary;

  // Primary financials
  const contractVal    = num(s?.totalContractValue);
  const collectedVerif = num(s?.totalCollectedVerified ?? s?.totalCollected);
  const collectedAll   = num(s?.totalCollectedAll    ?? s?.totalCollected);
  const outstanding    = num(s?.totalOutstanding     ?? s?.totalRemaining);
  const overdueAmt     = num(s?.overdueAmountComputed ?? s?.totalOverdue);
  const overdueCount   = s?.overdueInstallmentCountComputed ?? s?.overdueInstallmentCount ?? 0;
  const dueSoon        = num(s?.dueSoonAmount);
  const collectedMonth = num(s?.collectedThisMonth);
  const dueMonth       = num(s?.dueThisMonth);
  const contractCount  = s?.contractCount ?? 0;
  const depositCount   = s?.depositCount  ?? 0;

  const collectionRate = contractVal > 0 ? Math.round((collectedVerif / contractVal) * 100) : 0;
  const overdueRate    = contractVal > 0 ? parseFloat(((overdueAmt / contractVal) * 100).toFixed(1)) : 0;

  // Comparison deltas
  const contractDelta  = cmpS ? computeDelta(contractVal,   num(cmpS.totalContractValue))                         : undefined;
  const collectedDelta = cmpS ? computeDelta(collectedVerif, num(cmpS.totalCollectedVerified ?? cmpS.totalCollected)) : undefined;
  const outstandDelta  = cmpS ? computeDelta(outstanding,   num(cmpS.totalOutstanding ?? cmpS.totalRemaining))    : undefined;
  const overdueDelta   = cmpS ? computeDelta(overdueAmt,    num(cmpS.overdueAmountComputed ?? cmpS.totalOverdue)) : undefined;

  const aging    = dash?.aging   ?? [];
  const forecast = dash?.cashflowForecast;
  const agingMax = Math.max(1, ...aging.map((b) => num(b.amount)));

  const showFilters = !!(sp.q || sp.type || sp.projectId || sp.showFilters === '1');
  const projectOptions = projects.map((p) => ({ id: p.id, name: tx(p.name) }));

  return (
    <div className="space-y-4">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="التقارير المالية"
        description="رقابة التحصيل — المحصّل، المتبقي، المتأخر، والمستحقات القادمة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير',    href: '/dashboard/reports' },
          { label: 'المالي' },
        ]}
        actions={
          <div className="inline-flex items-center gap-1 rounded-xl border border-hairline bg-surface shadow-xs px-1.5 py-1.5">
            <ExportMenu
              label="تصدير"
              xlsxPath="/reports/financial-dashboard/export.xlsx"
              csvPath="/reports/financial-dashboard/export.csv"
              filenameBase="financial-dashboard"
              params={{ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }}
            />
          </div>
        }
      />

      <ReportsTabs active="financial" />
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
      />

      {dashRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {dashRes.error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1 — 4 Primary KPI Cards
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Contract value */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-amber-400" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-amber-600">
                <FileText />
              </span>
              {contractDelta && <Delta delta={contractDelta} />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">إجمالي قيمة العقود</p>
              <p className="mt-1.5 text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-tight text-slate-900 whitespace-nowrap" dir="ltr">
                {formatCurrency(contractVal)}
              </p>
              <p className="mt-2 text-xs text-slate-400">{contractCount} عقد · {depositCount} دفعة</p>
            </div>
          </div>
        </div>

        {/* Collected + rate */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-emerald-400" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-emerald-600">
                <DollarSign />
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {collectedDelta && <Delta delta={collectedDelta} />}
                <span className={cn(
                  'inline-flex items-center h-5 px-2 rounded-full text-[11px] font-black',
                  collectionRate >= 75 ? 'bg-emerald-100 text-emerald-700' : collectionRate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600',
                )}>
                  {collectionRate}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">المحصّل المؤكد</p>
              <p className="mt-1.5 text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-tight text-emerald-700 whitespace-nowrap" dir="ltr">
                {formatCurrency(collectedVerif)}
              </p>
              <p className="mt-2 text-xs text-slate-400 whitespace-nowrap">إجمالي مسجل: {formatCurrency(collectedAll)}</p>
            </div>
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-slate-300" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-200 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-slate-600">
                <Clock />
              </span>
              {outstandDelta && <Delta delta={outstandDelta} invert />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">المتبقي للتحصيل</p>
              <p className="mt-1.5 text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-tight text-slate-900 whitespace-nowrap" dir="ltr">
                {formatCurrency(outstanding)}
              </p>
              <p className="mt-2 text-xs text-slate-400">مستحق خلال 7 أيام: {formatCurrency(dueSoon)}</p>
            </div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-danger-500" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 ring-1 ring-inset ring-danger-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-danger-600">
                <AlertTriangle />
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {overdueDelta && <Delta delta={overdueDelta} invert />}
                {overdueRate > 0 && (
                  <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-black bg-danger-100 text-danger-700">
                    {overdueRate}%
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">المتأخر المحسوب</p>
              <p className="mt-1.5 text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-tight text-danger-700 whitespace-nowrap" dir="ltr">
                {formatCurrency(overdueAmt)}
              </p>
              <p className="mt-2 text-xs text-slate-400">{overdueCount} قسط متأخر</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary stats strip */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-hairline">
          {[
            { label: 'المحصّل هذا الشهر',       value: formatCurrency(collectedMonth), cls: 'text-success-700', ltr: true },
            { label: 'المستحق هذا الشهر',        value: formatCurrency(dueMonth),       cls: 'text-amber-600',  ltr: true },
            { label: 'عدد العقود',               value: contractCount.toLocaleString('ar-EG'),  cls: 'text-slate-900', ltr: false },
            { label: 'عدد الدفعات',              value: depositCount.toLocaleString('ar-EG'),   cls: 'text-slate-900', ltr: false },
            { label: 'أقساط متأخرة',             value: overdueCount.toLocaleString('ar-EG'),   cls: overdueCount > 0 ? 'text-danger-700' : 'text-slate-900', ltr: false },
          ].map((item) => (
            <div key={item.label} className="bg-surface px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 leading-tight">{item.label}</p>
              <p className={cn('text-base font-bold tabular-nums leading-tight whitespace-nowrap', item.cls)} dir={item.ltr ? 'ltr' : undefined}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Collection efficiency bar */}
      {contractVal > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs px-5 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0 [&_svg]:h-4 [&_svg]:w-4">
                <TrendingUp />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">كفاءة التحصيل</p>
                <p className={cn(
                  'text-2xl font-black tabular-nums leading-none mt-0.5',
                  collectionRate >= 75 ? 'text-emerald-700' : collectionRate >= 40 ? 'text-amber-700' : 'text-danger-700',
                )}>
                  {collectionRate}%
                </p>
              </div>
            </div>
            <div className="flex-1 min-w-[100px]">
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    collectionRate >= 75 ? 'bg-emerald-500' : collectionRate >= 40 ? 'bg-amber-400' : 'bg-danger-500',
                  )}
                  style={{ width: `${Math.min(100, collectionRate)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-6 shrink-0 text-end">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">متأخر</p>
                <p className={cn('text-base font-black tabular-nums', overdueRate > 0 ? 'text-danger-700' : 'text-slate-300')}>{overdueRate}%</p>
              </div>
              <div className="w-px h-7 bg-hairline" />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">متبقي</p>
                <p className="text-base font-black tabular-nums text-slate-700">{contractVal > 0 ? (100 - collectionRate) : 0}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2 — Cashflow Trend (3/5) + Distribution (2/5)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Cashflow bar chart */}
        <div className="xl:col-span-3 bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <BarChart3 />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">اتجاهات التدفق النقدي</p>
                <p className="text-[11px] text-slate-400 mt-0.5">المحصّل والمستحق خلال الأشهر الستة الماضية</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />المحصّل
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-amber-400" />المستحق
              </span>
            </div>
          </div>
          <div className="px-5 py-5">
            <CashflowBarChart data={dash?.cashflowTrend ?? []} />
          </div>
        </div>

        {/* Payment distribution */}
        <div className="xl:col-span-2 bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <CreditCard />
            </span>
            <div>
              <p className="text-[13px] font-bold text-slate-800">توزيع قيمة العقود</p>
              <p className="text-[11px] text-slate-400 mt-0.5">محصّل · متأخر · متبقي</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5 flex-1">
            {contractVal > 0 && (
              /* Stacked bar */
              <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(collectedVerif / contractVal) * 100}%` }} />
                <div className="h-full bg-danger-400 transition-all" style={{ width: `${(overdueAmt / contractVal) * 100}%` }} />
              </div>
            )}

            <div className="space-y-3">
              {((): { label: string; amount: number; pct: string; dot: string; textCls: string }[] => {
                const base = contractVal > 0 ? contractVal : 1;
                return [
                  { label: 'إجمالي قيمة العقود',  amount: contractVal,    pct: '100%',                          dot: 'bg-slate-300',   textCls: 'text-slate-900' },
                  { label: 'المحصّل المؤكد',        amount: collectedVerif, pct: `${collectionRate}%`,            dot: 'bg-emerald-500', textCls: 'text-emerald-700' },
                  { label: 'المتأخر',               amount: overdueAmt,     pct: `${((overdueAmt/base)*100).toFixed(1)}%`,  dot: 'bg-danger-500',  textCls: 'text-danger-700' },
                  { label: 'المتبقي للتحصيل',       amount: outstanding,    pct: `${((outstanding/base)*100).toFixed(1)}%`, dot: 'bg-slate-200',   textCls: 'text-slate-700' },
                ];
              })().map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', r.dot)} />
                  <span className="flex-1 text-xs text-slate-600 min-w-0">{r.label}</span>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0 w-8 text-start">{r.pct}</span>
                  <span className={cn('text-xs font-bold tabular-nums whitespace-nowrap shrink-0', r.textCls)} dir="ltr">
                    {formatCurrency(r.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Month comparison */}
            <div className="mt-auto pt-4 border-t border-hairline grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">محصّل هذا الشهر</p>
                <p className="text-base font-black tabular-nums text-success-700 whitespace-nowrap" dir="ltr">{formatCurrency(collectedMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">مستحق هذا الشهر</p>
                <p className="text-base font-black tabular-nums text-amber-600 whitespace-nowrap" dir="ltr">{formatCurrency(dueMonth)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 3 — Cashflow Forecast (conditional)
      ════════════════════════════════════════════════════════════════════ */}
      {forecast && (forecast.next30 > 0 || forecast.next3160 > 0 || forecast.next6190 > 0) && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <CalendarDays />
            </span>
            <div>
              <p className="text-[13px] font-bold text-slate-800">توقعات التحصيل القادمة</p>
              <p className="text-[11px] text-slate-400 mt-0.5">الأقساط PENDING المستحقة في الفترات القادمة</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-hairline">
            {[
              { label: 'خلال 30 يومًا',  amount: forecast.next30,   pctCls: 'bg-brand-500',  valCls: 'text-brand-700',  bg: 'bg-brand-50/60' },
              { label: '31 – 60 يومًا',  amount: forecast.next3160, pctCls: 'bg-amber-400',  valCls: 'text-amber-700',  bg: 'bg-amber-50/60' },
              { label: '61 – 90 يومًا',  amount: forecast.next6190, pctCls: 'bg-violet-400', valCls: 'text-violet-700', bg: 'bg-violet-50/60' },
            ].map((b) => {
              const total = forecast.next30 + forecast.next3160 + forecast.next6190;
              const pct   = total > 0 ? Math.round((b.amount / total) * 100) : 0;
              return (
                <div key={b.label} className={cn('px-5 py-5', b.bg)}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{b.label}</p>
                  <p className={cn('text-[24px] font-black tabular-nums leading-none tracking-tight whitespace-nowrap', b.valCls)} dir="ltr">
                    {formatCurrency(b.amount)}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/70 overflow-hidden">
                    <div className={cn('h-full rounded-full', b.pctCls)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{pct}% من إجمالي التوقعات</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 4 — Aging Analysis
      ════════════════════════════════════════════════════════════════════ */}
      {aging.length > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-danger-50 text-danger-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <AlertTriangle />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">أعمار المتأخرات</p>
                <p className="text-[11px] text-slate-400 mt-0.5">توزيع المبالغ المتأخرة حسب عمر الدين</p>
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
              {formatCurrency(aging.reduce((s, b) => s + num(b.amount), 0))} إجمالي
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline">
            {aging.map((b) => {
              const amt    = num(b.amount);
              const isHigh = b.label === '90+' || b.label === '61-90';
              const active = b.count > 0;
              const pct    = (amt / agingMax) * 100;
              return (
                <div key={b.label} className={cn('bg-surface px-5 py-4', !active && 'opacity-50')}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{AGING_LABELS[b.label] ?? b.label}</p>
                    <span className={cn(
                      'inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[10px] font-bold shrink-0',
                      active && isHigh  ? 'bg-danger-100 text-danger-700' :
                      active && !isHigh ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-400',
                    )}>
                      {b.count}
                    </span>
                  </div>
                  <p className={cn(
                    'text-[22px] font-black tabular-nums leading-none tracking-tight whitespace-nowrap',
                    active && isHigh  ? 'text-danger-700' :
                    active && !isHigh ? 'text-amber-700'  :
                    'text-slate-300',
                  )} dir="ltr">
                    {formatCurrency(amt)}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        isHigh ? 'bg-danger-400' : 'bg-amber-300',
                        !active && 'bg-slate-200',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 5 — Overdue Installments Table
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-danger-100 bg-danger-50/40">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-danger-100 text-danger-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
            <AlertTriangle />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-danger-800">الأقساط المتأخرة</p>
            {overdueCount > 0 && (
              <p className="text-[11px] text-danger-600 mt-0.5">{overdueCount} قسط متأخر محسوب</p>
            )}
          </div>
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap shrink-0 flex items-center gap-1">
            عرض الكل <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {(!dash?.overdue || dash.overdue.length === 0) ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BadgeCheck className="h-7 w-7 text-slate-200" />
            <p className="text-sm text-slate-400">لا توجد أقساط متأخرة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-surface-muted/60 text-[10px] font-bold tracking-wide text-slate-500 border-b border-hairline">
                <tr>
                  <th className="text-start py-2.5 ps-5 pe-4">العميل</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">رقم العقد</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">الوحدة</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">النوع</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">الاستحقاق</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">المبلغ</th>
                  <th className="text-start py-2.5 ps-4 pe-5 whitespace-nowrap">التأخر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {dash.overdue.map((row) => {
                  const c    = row.plan.contract;
                  const days = daysOverdue(row.dueDate);
                  return (
                    <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors align-middle">
                      <td className="py-3 ps-5 pe-4 font-semibold text-slate-800 max-w-[160px] truncate">{c.customer.fullName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link href={`/dashboard/contracts/${c.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                          {c.contractNumber ?? `#${c.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{c.unit.code}</td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', PAYMENT_TYPE_CLS[row.type] ?? 'bg-slate-100 text-slate-600')}>
                          {PAYMENT_TYPE_LABELS[row.type] ?? row.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatDate(row.dueDate)}</td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold tabular-nums text-slate-900" dir="ltr">{formatCurrency(row.amount)}</td>
                      <td className="py-3 ps-4 pe-5 whitespace-nowrap">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold',
                          days > 60 ? 'bg-danger-100 text-danger-700' :
                          days > 30 ? 'bg-red-100 text-red-600' :
                          days > 7  ? 'bg-amber-100 text-amber-700' :
                          'bg-orange-100 text-orange-600',
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
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 6 — Upcoming Payments (2 col)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: 'المستحقات هذا الأسبوع',  rows: dash?.upcomingThisWeek  ?? [], empty: 'لا توجد مستحقات هذا الأسبوع' },
          { title: 'بقية مستحقات الشهر',    rows: dash?.upcomingThisMonth ?? [], empty: 'لا توجد مستحقات إضافية هذا الشهر' },
        ].map((panel) => (
          <div key={panel.title} className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                  <CalendarDays />
                </span>
                <p className="text-[13px] font-bold text-slate-800">{panel.title}</p>
              </div>
              {panel.rows.length > 0 && (
                <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
                  {formatCurrency(panel.rows.reduce((s, r) => s + num(r.amount), 0))}
                </span>
              )}
            </div>
            {panel.rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                <BadgeCheck className="h-6 w-6 text-slate-200" />
                <p className="text-sm text-slate-400">{panel.empty}</p>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {panel.rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap shrink-0">{formatDate(row.dueDate)}</span>
                      <span className="text-sm font-medium text-slate-700 truncate">{row.plan.contract.customer.fullName}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums whitespace-nowrap text-slate-900 shrink-0" dir="ltr">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 7 — Collection by Payment Type
      ════════════════════════════════════════════════════════════════════ */}
      {(dash?.collectionByType ?? []).length > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <Wallet />
            </span>
            <div>
              <p className="text-[13px] font-bold text-slate-800">التحصيل حسب نوع الدفعة</p>
              <p className="text-[11px] text-slate-400 mt-0.5">توزيع الدفعات المسجلة والمؤكدة</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-surface-muted/60 text-[10px] font-bold tracking-wide text-slate-500 border-b border-hairline">
                <tr>
                  <th className="text-start py-2.5 ps-5 pe-4">نوع الدفعة</th>
                  <th className="text-start py-2.5 px-4">العدد</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">إجمالي مسجل</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">مؤكد</th>
                  <th className="text-start py-2.5 ps-4 pe-5 whitespace-nowrap">غير مؤكد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(dash?.collectionByType ?? []).map((c) => (
                  <tr key={c.type} className="hover:bg-surface-muted/40 transition-colors align-middle">
                    <td className="py-2.5 ps-5 pe-4">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', DEPOSIT_TYPE_CLS[c.type] ?? 'bg-slate-100 text-slate-600')}>
                        {DEPOSIT_TYPE_LABELS[c.type] ?? c.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 tabular-nums text-slate-600">{c.count.toLocaleString('ar-EG')}</td>
                    <td className="py-2.5 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalAll)}</td>
                    <td className="py-2.5 px-4 tabular-nums text-success-700 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalVerified)}</td>
                    <td className="py-2.5 ps-4 pe-5 tabular-nums text-amber-600 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalUnverified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 8 — Booking Pipeline + Liabilities (collapsed panels)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Booking pipeline */}
        {dash?.booking && (
          <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <Receipt />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">خط الحجوزات</p>
                <p className="text-[11px] text-slate-400 mt-0.5">مبالغ الحجز قبل التحول لعقود</p>
              </div>
            </div>
            <div className="divide-y divide-hairline">
              {[
                { label: 'حجوزات قيد المراجعة', value: `${dash.booking.pendingReservationsCount} · ${formatCurrency(dash.booking.pendingReservationsBookingAmount)}`, cls: 'text-amber-700' },
                { label: 'حجوزات معتمدة',       value: `${dash.booking.approvedReservationsCount} · ${formatCurrency(dash.booking.approvedReservationsBookingAmount)}`, cls: 'text-slate-900' },
                { label: 'مبالغ الحجز المؤكدة', value: formatCurrency(dash.booking.bookingCollectedVerified), cls: 'text-success-700' },
                { label: 'تقدير غير المحصّل',   value: formatCurrency(dash.booking.bookingUncollectedEstimate), cls: 'text-slate-600' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={cn('text-sm font-bold tabular-nums whitespace-nowrap', row.cls)}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liabilities */}
        {dash?.liabilities && (
          <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <Coins />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">الالتزامات غير المدفوعة</p>
                <p className="text-[11px] text-slate-400 mt-0.5">العمولات والمستحقات المعلقة</p>
              </div>
            </div>
            <div className="divide-y divide-hairline">
              {[
                { label: 'إجمالي الالتزامات غير المدفوعة', value: formatCurrency(dash.liabilities.totalUnpaidLiabilities),                      cls: 'text-danger-700 font-black' },
                { label: 'مستحقات المبيعات غير المدفوعة',  value: formatCurrency(dash.liabilities.salesBonus.unpaidAmount),                     cls: 'text-amber-700' },
                { label: 'عمولات الوسطاء غير المدفوعة',   value: formatCurrency(dash.liabilities.brokerCommissions.unpaidAmount),              cls: 'text-amber-700' },
                { label: 'المدفوع من العمولات',            value: formatCurrency(num(dash.liabilities.salesBonus.paidAmount) + num(dash.liabilities.brokerCommissions.paidAmount)), cls: 'text-success-700' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={cn('text-sm tabular-nums whitespace-nowrap font-bold', row.cls)} dir="ltr">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 9 — Recent Deposits
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <CircleDollarSign />
            </span>
            <div>
              <p className="text-[13px] font-bold text-slate-800">آخر الدفعات</p>
              <p className="text-[11px] text-slate-400 mt-0.5">أحدث الدفعات المسجلة حسب الفلاتر المختارة</p>
            </div>
          </div>
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap flex items-center gap-1">
            عرض الكل <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {(!dash || dash.recentDeposits.length === 0) ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CircleDollarSign className="h-7 w-7 text-slate-200" />
            <p className="text-sm text-slate-400">لا توجد دفعات مسجلة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[580px]">
              <thead className="bg-surface-muted/60 text-[10px] font-bold tracking-wide text-slate-500 border-b border-hairline">
                <tr>
                  <th className="text-start py-2.5 ps-5 pe-4 whitespace-nowrap">النوع</th>
                  <th className="text-start py-2.5 px-4">العميل</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">الوحدة</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">المرجع</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">تاريخ الدفع</th>
                  <th className="text-start py-2.5 px-4 whitespace-nowrap">المبلغ</th>
                  <th className="text-start py-2.5 ps-4 pe-5 whitespace-nowrap">التحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {dash.recentDeposits.slice(0, 10).map((d) => (
                  <tr key={d.id} className="hover:bg-surface-muted/40 transition-colors align-middle">
                    <td className="py-2.5 ps-5 pe-4 whitespace-nowrap">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium', DEPOSIT_TYPE_CLS[d.type] ?? 'bg-slate-100 text-slate-600')}>
                        {DEPOSIT_TYPE_LABELS[d.type] ?? d.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800 max-w-[160px] truncate">{getDepositLabel(d)}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{getDepositUnit(d)}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {d.contract ? (
                        <Link href={`/dashboard/contracts/${d.contract.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                          {d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8)}`}
                        </Link>
                      ) : d.reservation ? (
                        <Link href={`/dashboard/reservations/${d.reservation.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {d.reservation.reservationNumber ?? `#${d.reservation.id.slice(0, 8)}`}
                        </Link>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatDate(d.paidAt)}</td>
                    <td className="py-2.5 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">{formatCurrency(d.amount)}</td>
                    <td className="py-2.5 ps-4 pe-5 whitespace-nowrap">
                      {d.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />متحقق
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />معلّق
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Delta chip ─────────────────────────────────────────────────────────────────
function Delta({ delta, invert }: { delta: { value: string; direction: 'up' | 'down' | 'flat' }; invert?: boolean }) {
  const up   = delta.direction === 'up';
  const down = delta.direction === 'down';
  const good = invert ? down : up;
  const bad  = invert ? up   : down;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 h-5 text-[10px] font-bold shrink-0',
      good && 'bg-success-50 text-success-700',
      bad  && 'bg-danger-50 text-danger-700',
      delta.direction === 'flat' && 'bg-slate-100 text-slate-500',
    )}>
      <span aria-hidden>{up ? '▲' : down ? '▼' : '•'}</span>
      {delta.value}
    </span>
  );
}
