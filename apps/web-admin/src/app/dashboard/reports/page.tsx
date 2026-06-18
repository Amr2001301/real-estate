import type { ReactNode } from 'react';
import {
  BarChart3,
  BookmarkCheck,
  CircleDollarSign,
  FileText,
  MapPin,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  ArrowLeft,
  Star,
  Trophy,
  CalendarDays,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { formatCurrency, tx } from '@/lib/format';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PageHeader } from '@/components/ui/page-header';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/export-menu';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportsTabs } from './_components/reports-tabs';
import { SalesTrendChart } from './_components/sales-trend-chart';

// ── API shapes ────────────────────────────────────────────────────────────────
interface Sales {
  contracts: number;
  total: number | string;
  byProject?: Array<{ projectId: string; total: number; count: number }>;
}
interface Financial {
  deposits: number;
  verified: number;
  total: number | string;
}
interface SalesTrendPoint {
  month: number;
  label: string;
  contracts: number;
  total: number;
}
interface SalesFunnel {
  leads: number;
  visits: number;
  reservations: number;
  contracts: number;
}
interface BrokerEntry {
  brokerId: string;
  brokerName: string;
  commissionAmount: number;
  count: number;
}
interface ProjectOption { id: string; name: { ar: string; en: string } }
interface PagedProjects { data: ProjectOption[] }

// ── Status maps ────────────────────────────────────────────────────────────────
const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING:   'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  APPROVED:  'معتمد',
  CONVERTED: 'محوّل إلى عقد',
  CANCELLED: 'ملغى',
  EXPIRED:   'منتهٍ',
};
const RESERVATION_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING:   'warning',
  CONFIRMED: 'success',
  APPROVED:  'success',
  CONVERTED: 'brand',
  CANCELLED: 'danger',
  EXPIRED:   'gray',
};

const Q_MONTHS: Record<number, number[]> = {
  1: [1,2,3], 2: [4,5,6], 3: [7,8,9], 4: [10,11,12],
};

interface Search {
  mode?: string; month?: string; year?: string; quarter?: string;
  dateFrom?: string; dateTo?: string; compare?: string; projectId?: string; period?: string;
}

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}
function pctStr(a: number, b: number): string | null {
  if (!b) return null;
  return `${Math.round((a / b) * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const resolved = resolveReportDateRange(sp);
  const { dateFrom, dateTo, year, mode, month, quarter } = resolved;
  const compare  = (sp.compare ?? 'none') as CompareMode;
  const cmpRange = resolveComparisonDateRange(resolved, compare);
  const qs       = `dateFrom=${dateFrom}&dateTo=${dateTo}`;

  const [
    salesRes, financialRes, reservationsRes, trendRes,
    projectsRes, funnelRes, brokersRes,
    cmpSalesRes, cmpFinancialRes,
  ] = await Promise.all([
    safe(api.get<Sales>(`/reports/sales?${qs}`)),
    safe(api.get<Financial>(`/reports/financial?${qs}`)),
    safe(api.get<Record<string, number>>(`/reports/reservations?${qs}`)),
    safe(api.get<SalesTrendPoint[]>(`/reports/sales-trend?year=${year}`)),
    safe(api.get<PagedProjects>('/projects?pageSize=100')),
    safe(api.get<SalesFunnel>(`/reports/sales-funnel?${qs}`)),
    safe(api.get<BrokerEntry[]>(`/reports/broker-leaderboard?${qs}`)),
    cmpRange
      ? safe(api.get<Sales>(`/reports/sales?dateFrom=${cmpRange.dateFrom}&dateTo=${cmpRange.dateTo}`))
      : Promise.resolve({ data: null, error: null }),
    cmpRange
      ? safe(api.get<Financial>(`/reports/financial?dateFrom=${cmpRange.dateFrom}&dateTo=${cmpRange.dateTo}`))
      : Promise.resolve({ data: null, error: null }),
  ]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const projectMap = new Map<string, string>(
    (projectsRes.data?.data ?? []).map((p) => [p.id, tx(p.name)]),
  );
  const byProject      = (salesRes.data?.byProject ?? []).slice().sort((a, b) => Number(b.total) - Number(a.total));
  const salesTotal     = Number(salesRes.data?.total ?? 0);
  const contractsCount = salesRes.data?.contracts ?? 0;
  const avgContract    = contractsCount > 0 ? salesTotal / contractsCount : 0;
  const financialTotal = Number(financialRes.data?.total ?? 0);
  const depositsCount  = financialRes.data?.deposits ?? 0;
  const verifiedCount  = financialRes.data?.verified ?? 0;
  const trendData      = trendRes.data ?? [];
  const funnel         = funnelRes.data;
  const brokers        = brokersRes.data ?? [];
  const totalCommissions = brokers.reduce((s, b) => s + b.commissionAmount, 0);

  const reservationEntries = Object.entries(reservationsRes.data ?? {}).sort(([, a], [, b]) => Number(b) - Number(a));

  const bestTrendMonth = trendData.length > 0
    ? trendData.reduce((best, d) => d.contracts > best.contracts ? d : best, trendData[0]!)
    : null;

  const topProject = byProject[0]
    ? { name: projectMap.get(byProject[0].projectId) ?? 'غير معروف', total: byProject[0].total, count: byProject[0].count }
    : null;

  const overallConvRate = pct(funnel?.contracts ?? 0, funnel?.leads ?? 0);
  const overallConvStr  = pctStr(funnel?.contracts ?? 0, funnel?.leads ?? 0);

  const salesDelta     = cmpSalesRes?.data ? computeDelta(salesTotal,      Number(cmpSalesRes.data.total ?? 0))        : undefined;
  const contractsDelta = cmpSalesRes?.data ? computeDelta(contractsCount,  cmpSalesRes.data.contracts ?? 0)            : undefined;
  const financialDelta = cmpFinancialRes?.data ? computeDelta(financialTotal, Number(cmpFinancialRes.data.total ?? 0)) : undefined;

  const highlightMonths =
    mode === 'monthly'   ? [month] :
    mode === 'quarterly' ? (Q_MONTHS[quarter] ?? []) :
    [];

  const exportParams: Record<string, string> = { dateFrom, dateTo };
  const anyError = salesRes.error || financialRes.error || reservationsRes.error;

  // Funnel stage definitions
  const funnelStages = funnel ? [
    {
      label: 'الفرص',    icon: UserPlus,      value: funnel.leads,        barColor: 'bg-brand-500',   textColor: 'text-brand-700',   iconBg: 'bg-brand-50',   iconColor: 'text-brand-600',   conv: null,                                             pctOfLeads: 100,
    },
    {
      label: 'الزيارات', icon: MapPin,        value: funnel.visits,       barColor: 'bg-blue-500',    textColor: 'text-blue-700',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    conv: pctStr(funnel.visits,       funnel.leads),          pctOfLeads: pct(funnel.visits,       funnel.leads),
    },
    {
      label: 'الحجوزات', icon: BookmarkCheck, value: funnel.reservations, barColor: 'bg-violet-500',  textColor: 'text-violet-700',  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  conv: pctStr(funnel.reservations, funnel.visits),         pctOfLeads: pct(funnel.reservations, funnel.leads),
    },
    {
      label: 'العقود',   icon: FileText,      value: funnel.contracts,    barColor: 'bg-emerald-500', textColor: 'text-emerald-700', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', conv: pctStr(funnel.contracts,    funnel.reservations),  pctOfLeads: pct(funnel.contracts,    funnel.leads),
    },
  ] : [];

  return (
    <div className="space-y-4">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="التقارير"
        description="تقرير المبيعات والعمليات — أداء العقود والدفعات والحجوزات خلال الفترة المحددة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير' },
        ]}
        actions={
          <div className="inline-flex items-center gap-1 rounded-xl border border-hairline bg-surface shadow-xs px-1.5 py-1.5">
            <ExportMenu label="تصدير المبيعات"   xlsxPath="/reports/sales/export.xlsx"       csvPath="/reports/sales/export.csv"       filenameBase="sales-report"       params={exportParams} />
            <ExportMenu label="تصدير المالية"    xlsxPath="/reports/financial/export.xlsx"   csvPath="/reports/financial/export.csv"   filenameBase="financial-report"   params={exportParams} />
            <ExportMenu label="تصدير التشغيلي"  xlsxPath="/reports/operational/export.xlsx" csvPath="/reports/operational/export.csv" filenameBase="operational-report" />
          </div>
        }
      />

      <ReportsTabs active="sales" />
      <ReportFilterBar
        defaultMode={mode as PeriodMode}
        defaultMonth={month}
        defaultYear={year}
        defaultQuarter={quarter}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        defaultCompare={compare}
        basePath="/dashboard/reports"
      />

      {anyError && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">{anyError}</div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1 — Four primary KPI cards
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total Sales — primary, amber */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-amber-400" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-amber-600">
                <Wallet />
              </span>
              {salesDelta && <Delta delta={salesDelta} />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none">إجمالي المبيعات</p>
              <p className="mt-2 text-[26px] lg:text-[30px] font-black tabular-nums leading-none tracking-tight text-slate-900 whitespace-nowrap" dir="ltr">
                {formatCurrency(salesTotal)}
              </p>
              <p className="mt-2 text-xs text-slate-400">{contractsCount} عقد مبرم خلال الفترة</p>
            </div>
          </div>
        </div>

        {/* Contracts */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-slate-300" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-200 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-slate-600">
                <FileText />
              </span>
              {contractsDelta && <Delta delta={contractsDelta} />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none">العقود</p>
              <p className="mt-2 text-[30px] font-black tabular-nums leading-none tracking-tight text-slate-900">
                {contractsCount.toLocaleString('ar-EG')}
              </p>
              <p className="mt-2 text-xs text-slate-400 whitespace-nowrap" dir="ltr">متوسط: {formatCurrency(avgContract)}</p>
            </div>
          </div>
        </div>

        {/* Deposits */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-emerald-400" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-emerald-600">
                <CircleDollarSign />
              </span>
              {financialDelta && <Delta delta={financialDelta} />}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none">الدفعات المحصّلة</p>
              <p className="mt-2 text-[22px] lg:text-[26px] font-black tabular-nums leading-none tracking-tight text-emerald-700 whitespace-nowrap" dir="ltr">
                {formatCurrency(financialTotal)}
              </p>
              <p className="mt-2 text-xs text-slate-400">{depositsCount} دفعة · {verifiedCount} مؤكدة</p>
            </div>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
          <div className="h-[3px] bg-violet-400" />
          <div className="p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-inset ring-violet-100 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px] text-violet-600">
                <TrendingUp />
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none">معدل التحويل</p>
              <p className={cn(
                'mt-2 text-[30px] font-black tabular-nums leading-none tracking-tight',
                overallConvRate >= 50 ? 'text-emerald-700' : overallConvRate >= 25 ? 'text-amber-700' : 'text-violet-700',
              )}>
                {overallConvStr ?? '—'}
              </p>
              <p className="mt-2 text-xs text-slate-400">فرصة → عقد · {(funnel?.leads ?? 0)} فرصة</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2 — Sales Trend (3/5) + Insights Panel (2/5)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Trend chart */}
        <div className="lg:col-span-3 bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <BarChart3 />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">اتجاه المبيعات الشهري</p>
                <p className="text-[11px] text-slate-400 mt-0.5">أداء العقود خلال {year}</p>
              </div>
            </div>
            <div className="text-end shrink-0">
              <p className="text-base font-black tabular-nums text-slate-900 leading-none">
                {trendData.reduce((s, d) => s + d.contracts, 0).toLocaleString('ar-EG')} عقد
              </p>
              {bestTrendMonth && bestTrendMonth.contracts > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                  أفضل شهر: <span className="font-semibold text-slate-600">{bestTrendMonth.label}</span>
                </p>
              )}
            </div>
          </div>
          <div className="px-5 py-5">
            <SalesTrendChart data={trendData} highlightMonths={highlightMonths} />
          </div>
        </div>

        {/* Insights panel */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Reservation status */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex-1">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <BookmarkCheck />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-800">حالة الحجوزات</p>
              </div>
              {reservationEntries.length > 0 && (
                <span className="text-xs font-bold tabular-nums text-slate-700 shrink-0">
                  {reservationEntries.reduce((s, [, c]) => s + Number(c), 0).toLocaleString('ar-EG')}
                </span>
              )}
            </div>
            {reservationEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <BookmarkCheck className="h-6 w-6 text-slate-200" />
                <p className="text-sm text-slate-400">لا توجد حجوزات</p>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {reservationEntries.map(([status, count]) => {
                  const total = reservationEntries.reduce((s, [, c]) => s + Number(c), 0);
                  const barPct = total > 0 ? (Number(count) / total) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center gap-3 px-5 py-2.5">
                      <Badge tone={RESERVATION_STATUS_TONE[status] ?? 'gray'} size="sm">
                        {RESERVATION_STATUS_LABEL[status] ?? status}
                      </Badge>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            status === 'CONVERTED' ? 'bg-brand-500' :
                            status === 'CONFIRMED' || status === 'APPROVED' ? 'bg-emerald-500' :
                            status === 'CANCELLED' || status === 'EXPIRED' ? 'bg-slate-300' :
                            'bg-amber-400',
                          )}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0 w-6 text-end">
                        {Number(count).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-hairline">
              {[
                { label: 'أفضل مشروع',      value: topProject?.name ?? '—',                              sub: topProject ? `${formatCurrency(topProject.total)}` : '',  icon: <Trophy className="h-3.5 w-3.5" />, iconBg: 'bg-amber-50 text-amber-600' },
                { label: 'أفضل شهر',        value: bestTrendMonth?.contracts ? bestTrendMonth.label : '—', sub: bestTrendMonth?.contracts ? `${bestTrendMonth.contracts} عقد` : '',  icon: <CalendarDays className="h-3.5 w-3.5" />, iconBg: 'bg-brand-50 text-brand-600' },
                { label: 'متوسط العقد',      value: null, valueNode: <span dir="ltr" className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">{formatCurrency(avgContract)}</span>, sub: 'متوسط محسوب', icon: <Layers className="h-3.5 w-3.5" />, iconBg: 'bg-slate-100 text-slate-600' },
                { label: 'أعلى وسيط',       value: brokers[0]?.brokerName ?? '—',                        sub: brokers[0] ? formatCurrency(brokers[0].commissionAmount) : '', icon: <Star className="h-3.5 w-3.5" />, iconBg: 'bg-violet-50 text-violet-600' },
              ].map((item) => (
                <div key={item.label} className="bg-surface px-4 py-3.5">
                  <div className={cn('inline-flex h-6 w-6 items-center justify-center rounded-lg mb-2', item.iconBg)}>
                    {item.icon}
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">{item.label}</p>
                  {item.valueNode ?? (
                    <p className="text-sm font-bold text-slate-900 mt-1 leading-tight truncate max-w-full">{item.value}</p>
                  )}
                  {item.sub && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate whitespace-nowrap">{item.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 3 — Conversion Pipeline
      ════════════════════════════════════════════════════════════════════ */}
      {funnelStages.length > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">

          {/* Pipeline header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                <TrendingUp />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">مسار المبيعات</p>
                <p className="text-[11px] text-slate-400 mt-0.5">تتبع تحول الفرص إلى عقود</p>
              </div>
            </div>
            {overallConvStr && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">التحويل الإجمالي</span>
                <span className={cn(
                  'inline-flex items-center h-7 px-3 rounded-full text-sm font-black border',
                  overallConvRate >= 50 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-violet-50 border-violet-200 text-violet-700',
                )}>
                  {overallConvStr}
                </span>
              </div>
            )}
          </div>

          {/* Stage cards */}
          <div className="grid grid-cols-4">
            {funnelStages.map((stage, i) => {
              const StageIcon = stage.icon;
              const isLast = i === funnelStages.length - 1;
              return (
                <div key={stage.label} className={cn('relative flex flex-col', !isLast && 'border-e border-hairline')}>
                  {/* Content */}
                  <div className="px-5 pt-5 pb-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', stage.iconBg)}>
                        <StageIcon className={cn('h-4 w-4', stage.iconColor)} />
                      </div>
                      {/* Conversion from previous stage */}
                      {stage.conv && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="font-bold text-slate-500">{stage.conv}</span>
                          <ArrowLeft className="h-3 w-3 text-slate-300" />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className={cn('text-[32px] lg:text-[38px] font-black tabular-nums leading-none tracking-tight', stage.textColor)}>
                        {stage.value.toLocaleString('ar-EG')}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-1.5">{stage.label}</p>
                    </div>
                  </div>

                  {/* Bottom fill bar — proportional to leads */}
                  <div className="mt-auto">
                    <div className="mx-5 mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">{stage.pctOfLeads}% من الفرص</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', stage.barColor)}
                          style={{ width: `${stage.pctOfLeads}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drop-off summary footer */}
          <div className="border-t border-hairline bg-canvas/50 px-5 py-3">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">معدلات الانتقال</span>
              {[
                { label: 'فرصة → زيارة',  value: pctStr(funnel?.visits ?? 0, funnel?.leads ?? 0) },
                { label: 'زيارة → حجز',   value: pctStr(funnel?.reservations ?? 0, funnel?.visits ?? 0) },
                { label: 'حجز → عقد',     value: pctStr(funnel?.contracts ?? 0, funnel?.reservations ?? 0) },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">{r.label}</span>
                  <span className={cn('text-[13px] font-black tabular-nums', r.value ? 'text-slate-800' : 'text-slate-300')}>
                    {r.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 4 — Project Performance
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
            <BarChart3 />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-800">أداء المشاريع</p>
            <p className="text-[11px] text-slate-400 mt-0.5">مرتبة تنازليًا حسب إجمالي قيمة العقود</p>
          </div>
          {byProject.length > 0 && (
            <span className="text-xs text-slate-400 tabular-nums shrink-0">{byProject.length} مشروع</span>
          )}
        </div>

        {byProject.length === 0 ? (
          <EmptyState icon={<FileText />} title="لا توجد مبيعات" description="لا توجد بيانات مبيعات للفترة المحددة." />
        ) : (
          <div className="divide-y divide-hairline">
            {byProject.map((p, idx) => {
              const sharePct = salesTotal > 0 ? (Number(p.total) / salesTotal) * 100 : 0;
              const isTop    = idx === 0;
              const name     = projectMap.get(p.projectId) ?? 'غير معروف';
              return (
                <div key={p.projectId} className={cn('flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted/40 transition-colors', isTop && 'bg-amber-50/30')}>
                  {/* Rank */}
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                    isTop ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-400',
                  )}>
                    {isTop ? <Trophy className="h-3.5 w-3.5" /> : idx + 1}
                  </div>

                  {/* Project name */}
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold truncate', isTop ? 'text-slate-900' : 'text-slate-700')}>{name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.count} عقد</p>
                  </div>

                  {/* Value */}
                  <div className="text-end shrink-0 min-w-[120px]">
                    <p className={cn('text-sm font-black tabular-nums whitespace-nowrap', isTop ? 'text-slate-900' : 'text-slate-700')} dir="ltr">
                      {formatCurrency(p.total)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sharePct.toFixed(1)}%</p>
                  </div>

                  {/* Share bar */}
                  <div className="w-28 shrink-0 hidden sm:block">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', isTop ? 'bg-amber-400' : 'bg-slate-300')}
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 5 — Broker Leaderboard
      ════════════════════════════════════════════════════════════════════ */}
      {brokers.length > 0 && (
        <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-hairline">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <Users />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-800">أداء الوسطاء</p>
              <p className="text-[11px] text-slate-400 mt-0.5">مرتبون تنازليًا حسب العمولات المعتمدة خلال الفترة</p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums shrink-0">{brokers.length} وسيط</span>
          </div>

          <div className="divide-y divide-hairline">
            {brokers.map((b, idx) => {
              const sharePct = totalCommissions > 0 ? (b.commissionAmount / totalCommissions) * 100 : 0;
              const medal = idx === 0 ? { bg: 'bg-amber-100',  text: 'text-amber-700',  label: '🥇' }
                          : idx === 1 ? { bg: 'bg-slate-100',  text: 'text-slate-600',  label: '🥈' }
                          : idx === 2 ? { bg: 'bg-orange-100', text: 'text-orange-600', label: '🥉' }
                          : null;
              return (
                <div key={b.brokerId} className={cn('flex items-center gap-4 px-5 py-3 hover:bg-surface-muted/40 transition-colors', idx === 0 && 'bg-amber-50/30')}>
                  {/* Rank badge */}
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                    medal ? `${medal.bg} ${medal.text}` : 'bg-slate-50 text-slate-400',
                  )}>
                    {medal ? <span className="text-[14px]">{medal.label}</span> : idx + 1}
                  </div>

                  {/* Name */}
                  <p className="flex-1 text-sm font-semibold text-slate-900 truncate">{b.brokerName}</p>

                  {/* Count */}
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{b.count} عمولة</span>

                  {/* Amount */}
                  <div className="text-end shrink-0 min-w-[120px]">
                    <p className="text-sm font-black tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                      {formatCurrency(b.commissionAmount)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sharePct.toFixed(1)}%</p>
                  </div>

                  {/* Share bar */}
                  <div className="w-24 shrink-0 hidden sm:block">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-slate-200')}
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Delta chip ────────────────────────────────────────────────────────────────
function Delta({ delta }: { delta: { value: string; direction: 'up' | 'down' | 'flat' } }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 h-5 text-[10px] font-bold shrink-0',
      delta.direction === 'up'   && 'bg-success-50 text-success-700',
      delta.direction === 'down' && 'bg-danger-50 text-danger-700',
      delta.direction === 'flat' && 'bg-slate-100 text-slate-500',
    )}>
      <span aria-hidden>{delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}</span>
      {delta.value}
    </span>
  );
}
