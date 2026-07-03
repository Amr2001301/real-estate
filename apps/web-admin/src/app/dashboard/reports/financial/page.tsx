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
import { getReportsCurrency } from '@/lib/currency';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PremiumPageHero, PremiumSectionCard, PremiumMetricStrip } from '@/components/premium';
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
  const currency = await getReportsCurrency();
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
      <PremiumPageHero
        title="التقارير المالية"
        description="رقابة التحصيل — المحصّل، المتبقي، المتأخر، والمستحقات القادمة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير',    href: '/dashboard/reports' },
          { label: 'المالي' },
        ]}
        actions={
          <div className="flex items-center gap-2">
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
          ROW 1 — Primary KPI Strip
      ════════════════════════════════════════════════════════════════════ */}
      <PremiumMetricStrip
        variant="dashboard"
        cols={4}
        metrics={[
          {
            label:     'إجمالي قيمة العقود',
            icon:      <FileText />,
            value:     formatCurrency(contractVal, currency),
            tone:      'neutral',
            valueSize: 'compact',
            sub:       `${contractCount} عقد · ${depositCount} دفعة`,
            trend:     contractDelta ? `${contractDelta.direction === 'up' ? '▲' : contractDelta.direction === 'down' ? '▼' : '•'} ${contractDelta.value}` : undefined,
            trendCls:  contractDelta?.direction === 'up' ? 'text-success-600' : contractDelta?.direction === 'down' ? 'text-danger-600' : undefined,
          },
          {
            label:     'المحصّل المؤكد',
            icon:      <DollarSign />,
            value:     formatCurrency(collectedVerif, currency),
            tone:      'success',
            valueSize: 'compact',
            sub:       `${collectionRate}% محصّل · إجمالي: ${formatCurrency(collectedAll, currency)}`,
            trend:     collectedDelta ? `${collectedDelta.direction === 'up' ? '▲' : collectedDelta.direction === 'down' ? '▼' : '•'} ${collectedDelta.value}` : undefined,
            trendCls:  collectedDelta?.direction === 'up' ? 'text-success-600' : collectedDelta?.direction === 'down' ? 'text-danger-600' : undefined,
          },
          {
            label:     'المتبقي للتحصيل',
            icon:      <Clock />,
            value:     formatCurrency(outstanding, currency),
            tone:      'neutral',
            valueSize: 'compact',
            sub:       `مستحق خلال 7 أيام: ${formatCurrency(dueSoon, currency)}`,
            trend:     outstandDelta ? `${outstandDelta.direction === 'up' ? '▲' : outstandDelta.direction === 'down' ? '▼' : '•'} ${outstandDelta.value}` : undefined,
            trendCls:  outstandDelta?.direction === 'up' ? 'text-danger-600' : outstandDelta?.direction === 'down' ? 'text-success-600' : undefined,
          },
          {
            label:     'المتأخر المحسوب',
            icon:      <AlertTriangle />,
            value:     formatCurrency(overdueAmt, currency),
            tone:      overdueAmt > 0 ? 'danger' : 'neutral',
            valueSize: 'compact',
            sub:       `${overdueCount} قسط متأخر · ${overdueRate}%`,
            trend:     overdueDelta ? `${overdueDelta.direction === 'up' ? '▲' : overdueDelta.direction === 'down' ? '▼' : '•'} ${overdueDelta.value}` : undefined,
            trendCls:  overdueDelta?.direction === 'up' ? 'text-danger-600' : overdueDelta?.direction === 'down' ? 'text-success-600' : undefined,
          },
        ]}
      />

      <PremiumMetricStrip
        variant="compact"
        cols={5}
        metrics={[
          { label: 'المحصّل هذا الشهر', icon: <TrendingUp />,    value: formatCurrency(collectedMonth, currency),                  tone: 'success' },
          { label: 'المستحق هذا الشهر', icon: <CalendarDays />,  value: formatCurrency(dueMonth, currency),                        tone: 'warning' },
          { label: 'عدد العقود',        icon: <FileText />,      value: contractCount.toLocaleString('ar-EG'),           tone: 'neutral' },
          { label: 'عدد الدفعات',       icon: <Receipt />,       value: depositCount.toLocaleString('ar-EG'),            tone: 'neutral' },
          { label: 'أقساط متأخرة',     icon: <AlertTriangle />, value: overdueCount.toLocaleString('ar-EG'), tone: overdueCount > 0 ? 'danger' : 'neutral' },
        ]}
      />

      {contractVal > 0 && (
        <PremiumSectionCard
          icon={<TrendingUp />}
          title="كفاءة التحصيل"
          trailing={
            <span className={cn(
              'text-[22px] font-black tabular-nums',
              collectionRate >= 75 ? 'text-emerald-700' : collectionRate >= 40 ? 'text-amber-700' : 'text-danger-700',
            )}>
              {collectionRate}%
            </span>
          }
        >
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex-1 min-w-[120px]">
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
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-end">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">متأخر</p>
                <p className={cn('text-[18px] font-black tabular-nums', overdueRate > 0 ? 'text-danger-700' : 'text-slate-300')}>{overdueRate}%</p>
              </div>
              <div className="w-px h-8 bg-hairline" />
              <div className="text-end">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">متبقي</p>
                <p className="text-[18px] font-black tabular-nums text-slate-700">{contractVal > 0 ? (100 - collectionRate) : 0}%</p>
              </div>
            </div>
          </div>
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2 — Cashflow Trend (3/5) + Distribution (2/5)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Cashflow bar chart */}
        <PremiumSectionCard
          className="xl:col-span-3"
          icon={<BarChart3 />}
          title="اتجاهات التدفق النقدي"
          description="المحصّل والمستحق خلال الأشهر الستة الماضية"
          trailing={
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" />المحصّل
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-amber-400" />المستحق
              </span>
            </div>
          }
          padded={false}
        >
          <div className="px-5 py-5">
            <CashflowBarChart data={dash?.cashflowTrend ?? []} />
          </div>
        </PremiumSectionCard>

        {/* Payment distribution */}
        <PremiumSectionCard
          className="xl:col-span-2"
          icon={<CreditCard />}
          title="توزيع قيمة العقود"
          description="محصّل · متأخر · متبقي"
          padded={false}
        >
          {/* Stacked bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
              {contractVal > 0 && (
                <>
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(collectedVerif / contractVal) * 100}%` }} />
                  <div className="h-full bg-danger-400 transition-all" style={{ width: `${(overdueAmt / contractVal) * 100}%` }} />
                </>
              )}
            </div>
          </div>

          {/* Legend rows */}
          <div className="divide-y divide-hairline">
            {((): { label: string; amount: number; pct: string; dot: string; valCls: string }[] => {
              const base = contractVal > 0 ? contractVal : 1;
              return [
                { label: 'إجمالي قيمة العقود',  amount: contractVal,    pct: '100%',                                          dot: 'bg-slate-300',   valCls: 'text-slate-900' },
                { label: 'المحصّل المؤكد',        amount: collectedVerif, pct: `${collectionRate}%`,                            dot: 'bg-emerald-500', valCls: 'text-emerald-700' },
                { label: 'المتأخر',               amount: overdueAmt,     pct: `${((overdueAmt / base) * 100).toFixed(1)}%`,   dot: 'bg-danger-500',  valCls: 'text-danger-700' },
                { label: 'المتبقي للتحصيل',       amount: outstanding,    pct: `${((outstanding  / base) * 100).toFixed(1)}%`, dot: 'bg-slate-200',   valCls: 'text-slate-700' },
              ];
            })().map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-5 py-3.5">
                <span className={cn('h-3 w-3 rounded-full shrink-0', r.dot)} />
                <span className="flex-1 text-[13px] text-slate-600">{r.label}</span>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400 w-14 text-right shrink-0" dir="ltr">{r.pct}</span>
                <span className={cn('text-[13px] font-bold tabular-nums whitespace-nowrap shrink-0', r.valCls)} dir="ltr">
                  {formatCurrency(r.amount, currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Month footer */}
          <div className="grid grid-cols-2 gap-px bg-hairline border-t border-hairline mt-1">
            <div className="bg-surface px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">محصّل هذا الشهر</p>
              <p className="text-[15px] font-black tabular-nums text-success-700 whitespace-nowrap" dir="ltr">{formatCurrency(collectedMonth, currency)}</p>
            </div>
            <div className="bg-surface px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">مستحق هذا الشهر</p>
              <p className="text-[15px] font-black tabular-nums text-amber-600 whitespace-nowrap" dir="ltr">{formatCurrency(dueMonth, currency)}</p>
            </div>
          </div>
        </PremiumSectionCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 3 — Cashflow Forecast (conditional)
      ════════════════════════════════════════════════════════════════════ */}
      {forecast && (forecast.next30 > 0 || forecast.next3160 > 0 || forecast.next6190 > 0) && (
        <PremiumSectionCard
          icon={<CalendarDays />}
          title="توقعات التحصيل القادمة"
          description="الأقساط PENDING المستحقة في الفترات القادمة"
          padded={false}
        >
          <div className="grid grid-cols-3 gap-px bg-hairline">
            {[
              { label: 'خلال 30 يومًا',  amount: forecast.next30,   pctCls: 'bg-brand-500',  valCls: 'text-brand-700',  bg: 'bg-surface' },
              { label: '31 – 60 يومًا',  amount: forecast.next3160, pctCls: 'bg-amber-400',  valCls: 'text-amber-700',  bg: 'bg-surface' },
              { label: '61 – 90 يومًا',  amount: forecast.next6190, pctCls: 'bg-violet-400', valCls: 'text-violet-700', bg: 'bg-surface' },
            ].map((b) => {
              const total = forecast.next30 + forecast.next3160 + forecast.next6190;
              const pct   = total > 0 ? Math.round((b.amount / total) * 100) : 0;
              return (
                <div key={b.label} className={cn('px-5 py-5', b.bg)}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{b.label}</p>
                  <p className={cn('text-[24px] font-black tabular-nums leading-none tracking-tight whitespace-nowrap', b.valCls)} dir="ltr">
                    {formatCurrency(b.amount, currency)}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/70 overflow-hidden">
                    <div className={cn('h-full rounded-full', b.pctCls)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{pct}% من إجمالي التوقعات</p>
                </div>
              );
            })}
          </div>
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 4 — Aging Analysis
      ════════════════════════════════════════════════════════════════════ */}
      {aging.length > 0 && (
        <PremiumSectionCard
          tone="danger"
          icon={<AlertTriangle />}
          title="أعمار المتأخرات"
          description="توزيع المبالغ المتأخرة حسب عمر الدين"
          trailing={
            <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
              {formatCurrency(aging.reduce((s, b) => s + num(b.amount), 0), currency)} إجمالي
            </span>
          }
          padded={false}
        >
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
                    {formatCurrency(amt, currency)}
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
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 5 — Overdue Installments Table
      ════════════════════════════════════════════════════════════════════ */}
      <PremiumSectionCard
        tone="danger"
        icon={<AlertTriangle />}
        title="الأقساط المتأخرة"
        description={overdueCount > 0 ? `${overdueCount} قسط متأخر محسوب` : undefined}
        trailing={
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap flex items-center gap-1">
            عرض الكل <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
        padded={false}
      >
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
                  <th className="text-right py-2.5 px-4 whitespace-nowrap">المبلغ</th>
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
                      <td className="py-3 px-4 whitespace-nowrap font-bold tabular-nums text-slate-900 text-right" dir="ltr">{formatCurrency(row.amount, currency)}</td>
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
      </PremiumSectionCard>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 6 — Upcoming Payments (2 col)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: 'المستحقات هذا الأسبوع',  rows: dash?.upcomingThisWeek  ?? [], empty: 'لا توجد مستحقات هذا الأسبوع' },
          { title: 'بقية مستحقات الشهر',    rows: dash?.upcomingThisMonth ?? [], empty: 'لا توجد مستحقات إضافية هذا الشهر' },
        ].map((panel) => (
          <PremiumSectionCard
            key={panel.title}
            icon={<CalendarDays />}
            title={panel.title}
            trailing={
              panel.rows.length > 0
                ? <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap" dir="ltr">
                    {formatCurrency(panel.rows.reduce((s, r) => s + num(r.amount), 0), currency)}
                  </span>
                : undefined
            }
            padded={false}
          >
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
                      {formatCurrency(row.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </PremiumSectionCard>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 7 — Collection by Payment Type
      ════════════════════════════════════════════════════════════════════ */}
      {(dash?.collectionByType ?? []).length > 0 && (
        <PremiumSectionCard
          icon={<Wallet />}
          title="التحصيل حسب نوع الدفعة"
          description="توزيع الدفعات المسجلة والمؤكدة"
          padded={false}
        >
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-canvas/50 border-b border-hairline">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">نوع الدفعة</span>
            <span className="w-36 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">إجمالي مسجل</span>
            <span className="w-32 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">مؤكد</span>
            <span className="w-32 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">غير مؤكد</span>
          </div>
          <div className="divide-y divide-hairline">
            {(dash?.collectionByType ?? []).map((c) => (
              <div key={c.type} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-canvas/40 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn('inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0', DEPOSIT_TYPE_CLS[c.type] ?? 'bg-slate-100 text-slate-600')}>
                    {DEPOSIT_TYPE_LABELS[c.type] ?? c.type}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{c.count.toLocaleString('ar-EG')} دفعة</span>
                </div>
                <p className="w-36 text-right text-[13px] font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalAll, currency)}</p>
                <p className="w-32 text-right text-[13px] tabular-nums text-success-700 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalVerified, currency)}</p>
                <p className="w-32 text-right text-[13px] tabular-nums text-amber-600 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalUnverified, currency)}</p>
              </div>
            ))}
          </div>
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 8 — Booking Pipeline + Liabilities (collapsed panels)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Booking pipeline */}
        {dash?.booking && (
          <PremiumSectionCard
            icon={<Receipt />}
            title="خط الحجوزات"
            description="مبالغ الحجز قبل التحول لعقود"
            padded={false}
          >
            <div className="divide-y divide-hairline">
              {[
                { label: 'حجوزات قيد المراجعة', value: `${dash.booking.pendingReservationsCount} · ${formatCurrency(dash.booking.pendingReservationsBookingAmount, currency)}`, cls: 'text-amber-700' },
                { label: 'حجوزات معتمدة',       value: `${dash.booking.approvedReservationsCount} · ${formatCurrency(dash.booking.approvedReservationsBookingAmount, currency)}`, cls: 'text-slate-900' },
                { label: 'مبالغ الحجز المؤكدة', value: formatCurrency(dash.booking.bookingCollectedVerified, currency), cls: 'text-success-700' },
                { label: 'تقدير غير المحصّل',   value: formatCurrency(dash.booking.bookingUncollectedEstimate, currency), cls: 'text-slate-600' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={cn('text-sm font-bold tabular-nums whitespace-nowrap', row.cls)}>{row.value}</span>
                </div>
              ))}
            </div>
          </PremiumSectionCard>
        )}

        {/* Liabilities */}
        {dash?.liabilities && (
          <PremiumSectionCard
            icon={<Coins />}
            title="الالتزامات غير المدفوعة"
            description="العمولات والمستحقات المعلقة"
            padded={false}
          >
            <div className="divide-y divide-hairline">
              {[
                { label: 'إجمالي الالتزامات غير المدفوعة', value: formatCurrency(dash.liabilities.totalUnpaidLiabilities, currency),                      cls: 'text-danger-700 font-black' },
                { label: 'مستحقات المبيعات غير المدفوعة',  value: formatCurrency(dash.liabilities.salesBonus.unpaidAmount, currency),                     cls: 'text-amber-700' },
                { label: 'عمولات الوسطاء غير المدفوعة',   value: formatCurrency(dash.liabilities.brokerCommissions.unpaidAmount, currency),              cls: 'text-amber-700' },
                { label: 'المدفوع من العمولات',            value: formatCurrency(num(dash.liabilities.salesBonus.paidAmount) + num(dash.liabilities.brokerCommissions.paidAmount), currency), cls: 'text-success-700' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={cn('text-sm tabular-nums whitespace-nowrap font-bold', row.cls)} dir="ltr">{row.value}</span>
                </div>
              ))}
            </div>
          </PremiumSectionCard>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 9 — Recent Deposits
      ════════════════════════════════════════════════════════════════════ */}
      <PremiumSectionCard
        icon={<CircleDollarSign />}
        title="آخر الدفعات"
        description="أحدث الدفعات المسجلة حسب الفلاتر المختارة"
        trailing={
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap flex items-center gap-1">
            عرض الكل <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
        padded={false}
      >
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
                    <td className="py-2.5 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">{formatCurrency(d.amount, currency)}</td>
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
      </PremiumSectionCard>

    </div>
  );
}

