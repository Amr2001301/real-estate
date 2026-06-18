import type { ReactNode } from 'react';
import {
  BarChart3,
  BookmarkCheck,
  ChevronLeft,
  CircleDollarSign,
  DollarSign,
  FileText,
  Lightbulb,
  MapPin,
  TrendingUp,
  UserPlus,
  Users,
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
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
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

// ── Reservation labels / tones ─────────────────────────────────────────────
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

function convPct(a: number, b: number): string | null {
  if (!b) return null;
  return `${Math.round((a / b) * 100)}%`;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const resolved  = resolveReportDateRange(sp);
  const { dateFrom, dateTo, year, mode, month, quarter } = resolved;
  const compare   = (sp.compare ?? 'none') as CompareMode;
  const cmpRange  = resolveComparisonDateRange(resolved, compare);
  const qs        = `dateFrom=${dateFrom}&dateTo=${dateTo}`;

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

  // ── Derived values ──────────────────────────────────────────────────────
  const projectMap = new Map<string, string>(
    (projectsRes.data?.data ?? []).map((p) => [p.id, tx(p.name)]),
  );

  const byProject = (salesRes.data?.byProject ?? [])
    .slice().sort((a, b) => Number(b.total) - Number(a.total));

  const salesTotal     = Number(salesRes.data?.total ?? 0);
  const contractsCount = salesRes.data?.contracts ?? 0;
  const avgContract    = contractsCount > 0 ? salesTotal / contractsCount : 0;
  const financialTotal = Number(financialRes.data?.total ?? 0);
  const depositsCount  = financialRes.data?.deposits ?? 0;
  const verifiedCount  = financialRes.data?.verified ?? 0;

  const trendData          = trendRes.data ?? [];
  const funnel             = funnelRes.data;
  const brokers            = brokersRes.data ?? [];
  const reservationEntries = Object.entries(reservationsRes.data ?? {})
    .sort(([, a], [, b]) => Number(b) - Number(a));

  const bestTrendMonth = trendData.length > 0
    ? trendData.reduce((best, d) => d.contracts > best.contracts ? d : best, trendData[0]!)
    : null;

  const topProject = byProject[0]
    ? { name: projectMap.get(byProject[0].projectId) ?? 'غير معروف', total: byProject[0].total }
    : null;

  // Funnel conversion rates
  const leadsToVisits       = convPct(funnel?.visits ?? 0, funnel?.leads ?? 0);
  const visitsToReserv      = convPct(funnel?.reservations ?? 0, funnel?.visits ?? 0);
  const reservToContracts   = convPct(funnel?.contracts ?? 0, funnel?.reservations ?? 0);
  const overallConversion   = convPct(funnel?.contracts ?? 0, funnel?.leads ?? 0);

  // Comparison deltas
  const salesDelta      = cmpSalesRes?.data ? computeDelta(salesTotal,      Number(cmpSalesRes.data.total ?? 0))         : undefined;
  const contractsDelta  = cmpSalesRes?.data ? computeDelta(contractsCount,  cmpSalesRes.data.contracts ?? 0)             : undefined;
  const financialDelta  = cmpFinancialRes?.data ? computeDelta(financialTotal, Number(cmpFinancialRes.data.total ?? 0))  : undefined;

  const highlightMonths =
    mode === 'monthly'   ? [month]               :
    mode === 'quarterly' ? (Q_MONTHS[quarter] ?? []) :
    mode === 'yearly'    ? []                    :
                           [];

  const exportParams: Record<string, string> = { dateFrom, dateTo };
  const anyError = salesRes.error || financialRes.error || reservationsRes.error;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
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
            <ExportMenu
              label="تصدير المبيعات"
              xlsxPath="/reports/sales/export.xlsx"
              csvPath="/reports/sales/export.csv"
              filenameBase="sales-report"
              params={exportParams}
            />
            <ExportMenu
              label="تصدير المالية"
              xlsxPath="/reports/financial/export.xlsx"
              csvPath="/reports/financial/export.csv"
              filenameBase="financial-report"
              params={exportParams}
            />
            <ExportMenu
              label="تصدير التشغيلي"
              xlsxPath="/reports/operational/export.xlsx"
              csvPath="/reports/operational/export.csv"
              filenameBase="operational-report"
            />
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
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {anyError}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — Executive KPIs
      ════════════════════════════════════════════════════════════════════ */}

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-surface border border-hairline rounded-2xl shadow-xs">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-400" aria-hidden />
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              إجمالي المبيعات
            </p>
            <div className="mt-1.5 flex items-baseline gap-3">
              <p className="text-4xl lg:text-5xl font-bold tracking-tight tabular-nums text-slate-900 whitespace-nowrap leading-none" dir="ltr">
                {formatCurrency(salesTotal)}
              </p>
              {salesDelta && <DeltaChip delta={salesDelta} />}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              إجمالي قيمة العقود المبرمة خلال الفترة المحددة
            </p>
          </div>

          <div className="flex items-center gap-5 sm:gap-6 shrink-0 flex-wrap">
            <StatBlock label="عدد العقود" delta={contractsDelta}>
              <span className="text-xl font-bold tabular-nums text-slate-900 leading-none">
                {contractsCount.toLocaleString('ar-EG')}
              </span>
              <span className="text-xs text-slate-400 mt-0.5">عقد مسجّل</span>
            </StatBlock>

            <div className="w-px h-8 bg-hairline shrink-0" />

            <StatBlock label="متوسط قيمة العقد">
              <span className="text-xl font-bold tabular-nums text-slate-900 leading-none whitespace-nowrap" dir="ltr">
                {formatCurrency(avgContract)}
              </span>
              <span className="text-xs text-slate-400 mt-0.5">متوسط محسوب</span>
            </StatBlock>

            {topProject && (
              <>
                <div className="w-px h-8 bg-hairline shrink-0" />
                <StatBlock label="أعلى مشروع">
                  <span className="text-base font-semibold text-slate-900 leading-tight max-w-[140px] truncate">
                    {topProject.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 whitespace-nowrap" dir="ltr">
                    {formatCurrency(topProject.total)}
                  </span>
                </StatBlock>
              </>
            )}

            {overallConversion && (
              <>
                <div className="w-px h-8 bg-hairline shrink-0" />
                <StatBlock label="معدل التحويل الكلي">
                  <span className="text-xl font-bold tabular-nums text-emerald-700 leading-none">
                    {overallConversion}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">فرصة → عقد</span>
                </StatBlock>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI command strip */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline">
          {[
            { label: 'الدفعات المسجلة',    value: <span dir="ltr">{formatCurrency(financialTotal)}</span>, sub: `${depositsCount} دفعة`, cls: 'text-slate-900', delta: financialDelta },
            { label: 'الدفعات الموثّقة',    value: verifiedCount.toLocaleString('ar-EG'),                   sub: 'دفعة مؤكدة',           cls: 'text-success-700' },
            { label: 'الفرص في الفترة',     value: (funnel?.leads ?? 0).toLocaleString('ar-EG'),            sub: 'عميل محتمل',           cls: 'text-brand-700' },
            { label: 'الحجوزات في الفترة',  value: (funnel?.reservations ?? 0).toLocaleString('ar-EG'),     sub: 'حجز مسجّل',            cls: 'text-violet-700' },
          ].map((t) => (
            <div key={t.label} className="bg-surface px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 leading-none">{t.label}</p>
              <div className="flex items-baseline gap-1.5">
                <p className={cn('text-[20px] font-black tabular-nums leading-none tracking-tight', t.cls)}>{t.value}</p>
                {t.delta && <DeltaChip delta={t.delta} />}
              </div>
              {t.sub && <p className="text-[10px] text-slate-400 mt-1 leading-none">{t.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Conversion Funnel
      ════════════════════════════════════════════════════════════════════ */}
      {funnel && (
        <>
          <SectionDivider icon={<TrendingUp />} label="مسار التحويل" />

          <div className="bg-surface border border-hairline rounded-2xl shadow-xs overflow-hidden">
            {/* funnel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-canvas/40">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <p className="text-[13px] font-bold text-slate-800">تحليل مسار المبيعات</p>
              </div>
              {overallConversion && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">المعدل الكلي</span>
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold">
                    {overallConversion}
                  </span>
                </div>
              )}
            </div>

            {/* funnel stages */}
            <div className="flex items-stretch gap-px bg-hairline">
              {(
                [
                  { Icon: UserPlus,         label: 'الفرص',   value: funnel.leads,         iconBg: 'bg-brand-50',    iconText: 'text-brand-600',   valCls: 'text-brand-700',   conv: null },
                  { Icon: MapPin,           label: 'الزيارات', value: funnel.visits,         iconBg: 'bg-blue-50',     iconText: 'text-blue-600',    valCls: 'text-blue-700',    conv: leadsToVisits },
                  { Icon: BookmarkCheck,    label: 'الحجوزات', value: funnel.reservations,   iconBg: 'bg-violet-50',   iconText: 'text-violet-600',  valCls: 'text-violet-700',  conv: visitsToReserv },
                  { Icon: FileText,         label: 'العقود',  value: funnel.contracts,      iconBg: 'bg-emerald-50',  iconText: 'text-emerald-600', valCls: 'text-emerald-700', conv: reservToContracts },
                ] as const
              ).map((stage, i, arr) => {
                const Icon   = stage.Icon;
                const isLast = i === arr.length - 1;
                const pct    = funnel.leads > 0 ? (stage.value / funnel.leads) * 100 : 0;
                return (
                  <div key={stage.label} className="contents">
                    <div className="flex-1 bg-surface flex flex-col items-center gap-3 px-3 py-5">
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', stage.iconBg)}>
                        <Icon className={cn('h-4.5 w-4.5', stage.iconText)} />
                      </div>
                      <p className={cn('text-[28px] font-black tabular-nums leading-none tracking-tight', stage.valCls)}>
                        {stage.value.toLocaleString('ar-EG')}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 text-center leading-tight">{stage.label}</p>
                      {/* mini progress bar showing % of leads */}
                      <div className="w-full max-w-[80px]">
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', stage.iconBg.replace('bg-', 'bg-').replace('-50', '-400'))}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-medium text-slate-400 text-center mt-1">
                          {pct > 0 ? `${pct.toFixed(0)}% من الفرص` : '—'}
                        </p>
                      </div>
                    </div>
                    {!isLast && (
                      <div className="flex flex-col items-center justify-center gap-1 w-8 shrink-0 bg-surface">
                        {stage.conv && (
                          <span className="text-[9px] font-bold text-slate-400 rotate-0">{stage.conv}</span>
                        )}
                        <ChevronLeft className="h-3.5 w-3.5 text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* conversion rates footer */}
            <div className="grid grid-cols-3 gap-px bg-hairline border-t border-hairline">
              {[
                { label: 'الفرصة → زيارة',    rate: leadsToVisits },
                { label: 'الزيارة → حجز',      rate: visitsToReserv },
                { label: 'الحجز → عقد',         rate: reservToContracts },
              ].map((r) => (
                <div key={r.label} className="bg-canvas/50 px-4 py-2.5 text-center">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{r.label}</p>
                  <p className={cn('text-sm font-black tabular-nums', r.rate ? 'text-slate-800' : 'text-slate-300')}>
                    {r.rate ?? '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — Trend & Reservations
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<BarChart3 />} label="اتجاه المبيعات والحجوزات" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex items-start gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 mt-0.5">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">اتجاه المبيعات</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">أداء المبيعات شهريًا خلال {year}</p>
            </div>
            <div className="text-end shrink-0">
              <p className="text-sm font-bold tabular-nums text-slate-800 leading-none">
                {trendData.reduce((s, d) => s + d.contracts, 0)} عقد
              </p>
              {bestTrendMonth && bestTrendMonth.contracts > 0 && (
                <div className="mt-0.5">
                  <p className="text-2xs text-slate-400">أفضل شهر: {bestTrendMonth.label}</p>
                  <p className="text-2xs font-medium tabular-nums text-slate-500 whitespace-nowrap" dir="ltr">
                    {formatCurrency(bestTrendMonth.total)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="px-5 pt-4 pb-5">
            <SalesTrendChart data={trendData} highlightMonths={highlightMonths} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <BookmarkCheck className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">حالة الحجوزات</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">توزيع الحجوزات حسب الحالة</p>
            </div>
            {reservationEntries.length > 0 && (
              <div className="shrink-0 text-end">
                <p className="text-sm font-bold tabular-nums text-slate-800 leading-none">
                  {reservationEntries.reduce((s, [, c]) => s + Number(c), 0).toLocaleString('ar-EG')}
                </p>
                <p className="text-2xs text-slate-400 mt-0.5">إجمالي</p>
              </div>
            )}
          </CardHeader>
          <CardBody className="p-0 min-h-[140px]">
            {reservationEntries.length === 0 ? (
              <EmptyState
                icon={<BookmarkCheck />}
                title="لا توجد حجوزات"
                description="لا توجد بيانات حجوزات للفترة المحددة."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="text-start font-semibold py-2.5 ps-5 pe-4">الحالة</th>
                    <th className="text-end font-semibold py-2.5 ps-4 pe-5">العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {reservationEntries.map(([status, count]) => (
                    <tr key={status} className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors">
                      <td className="py-2.5 ps-5 pe-4">
                        <Badge tone={RESERVATION_STATUS_TONE[status] ?? 'gray'} size="sm">
                          {RESERVATION_STATUS_LABEL[status] ?? status}
                        </Badge>
                      </td>
                      <td className="py-2.5 ps-4 pe-5 text-end font-bold tabular-nums text-slate-900">
                        {Number(count).toLocaleString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                  {reservationEntries.length > 1 && (
                    <tr className="border-t-2 border-slate-100 bg-surface-muted/30">
                      <td className="py-2 ps-5 pe-4 text-2xs font-semibold uppercase tracking-wide text-slate-500">الإجمالي</td>
                      <td className="py-2 ps-4 pe-5 text-end text-sm font-bold tabular-nums text-slate-800">
                        {reservationEntries.reduce((s, [, c]) => s + Number(c), 0).toLocaleString('ar-EG')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — Project Performance
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<BarChart3 />} label="أداء المشاريع" />

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <BarChart3 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-slate-800">المبيعات حسب المشروع</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">مرتبة تنازليًا حسب إجمالي المبيعات</p>
          </div>
          {byProject.length > 0 && (
            <p className="text-xs text-slate-400 shrink-0 tabular-nums">{byProject.length} مشروع</p>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {byProject.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title="لا توجد مبيعات"
              description="لا توجد بيانات مبيعات للفترة المحددة."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="text-start font-semibold py-2.5 ps-5 pe-4 w-[40%]">المشروع</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">العقود</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">إجمالي المبيعات</th>
                    <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap w-[200px]">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map((p, idx) => {
                    const pct    = salesTotal > 0 ? ((Number(p.total) / salesTotal) * 100) : 0;
                    const pctStr = pct.toFixed(1);
                    return (
                      <tr key={p.projectId} className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors">
                        <td className="py-3 ps-5 pe-4">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-2xs font-bold tabular-nums leading-none shrink-0', idx === 0 ? 'text-brand-600' : 'text-slate-400')}>
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {projectMap.get(p.projectId) ?? <span className="text-slate-400 font-normal">غير معروف</span>}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">{p.count} عقد</td>
                        <td className="py-3 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="py-3 ps-4 pe-5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs tabular-nums text-slate-600 w-10 shrink-0 text-end">{pctStr}%</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                              <div
                                className={cn('h-full rounded-full transition-all', idx === 0 ? 'bg-brand-500' : 'bg-brand-300/70')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — Broker Leaderboard
      ════════════════════════════════════════════════════════════════════ */}
      {brokers.length > 0 && (
        <>
          <SectionDivider icon={<Users />} label="أداء الوسطاء" />

          <Card className="overflow-hidden">
            <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CircleDollarSign className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold text-slate-800">قائمة أداء الوسطاء</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">مرتبة تنازليًا حسب إجمالي العمولات المعتمدة خلال الفترة</p>
              </div>
              <p className="text-xs text-slate-400 shrink-0 tabular-nums">{brokers.length} وسيط</p>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                    <tr>
                      <th className="text-start font-semibold py-2.5 ps-5 pe-4 w-8">#</th>
                      <th className="text-start font-semibold py-2.5 px-4">الوسيط</th>
                      <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">عدد العمولات</th>
                      <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">إجمالي العمولات</th>
                      <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap w-[180px]">الحصة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokers.map((b, idx) => {
                      const totalCommissions = brokers.reduce((s, x) => s + x.commissionAmount, 0);
                      const pct = totalCommissions > 0 ? (b.commissionAmount / totalCommissions) * 100 : 0;
                      return (
                        <tr key={b.brokerId} className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors">
                          <td className="py-3 ps-5 pe-2">
                            <span className={cn(
                              'text-[11px] font-bold tabular-nums w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                              idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-orange-50 text-orange-600' : 'text-slate-400',
                            )}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate">{b.brokerName}</td>
                          <td className="py-3 px-4 tabular-nums text-slate-600">{b.count.toLocaleString('ar-EG')}</td>
                          <td className="py-3 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                            {formatCurrency(b.commissionAmount)}
                          </td>
                          <td className="py-3 ps-4 pe-5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs tabular-nums text-slate-500 w-10 shrink-0 text-end">{pct.toFixed(1)}%</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[100px]">
                                <div
                                  className={cn('h-full rounded-full', idx === 0 ? 'bg-amber-400' : 'bg-amber-200')}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6 — Operational Insights
      ════════════════════════════════════════════════════════════════════ */}
      {(contractsCount > 0 || reservationEntries.length > 0) && (
        <div className="flex flex-wrap items-stretch gap-3 rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">ملخص تشغيلي</span>
          </div>

          <div className="w-px bg-hairline self-stretch hidden sm:block" />

          {topProject && <InsightItem label="أعلى مشروع مبيعًا" value={topProject.name} />}
          {contractsCount > 0 && (
            <>
              <div className="w-px bg-hairline self-stretch hidden sm:block" />
              <InsightItem label="متوسط قيمة العقد">
                <span dir="ltr">{formatCurrency(avgContract)}</span>
              </InsightItem>
            </>
          )}
          {bestTrendMonth && bestTrendMonth.contracts > 0 && (
            <>
              <div className="w-px bg-hairline self-stretch hidden sm:block" />
              <InsightItem
                label="أفضل شهر في المبيعات"
                value={`${bestTrendMonth.label} (${bestTrendMonth.contracts} عقد)`}
              />
            </>
          )}
          {overallConversion && (
            <>
              <div className="w-px bg-hairline self-stretch hidden sm:block" />
              <InsightItem label="معدل التحويل الكلي" value={overallConversion} />
            </>
          )}
          {brokers[0] && (
            <>
              <div className="w-px bg-hairline self-stretch hidden sm:block" />
              <InsightItem label="أعلى وسيط أداءً" value={brokers[0].brokerName} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Local UI helpers ──────────────────────────────────────────────────────────

function SectionDivider({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 shrink-0 [&_svg]:h-3 [&_svg]:w-3">
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

function StatBlock({
  label, delta, children,
}: {
  label: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 leading-none shrink-0">{label}</p>
        {delta && <DeltaChip delta={delta} />}
      </div>
      {children}
    </div>
  );
}

function DeltaChip({ delta }: { delta: { value: string; direction: 'up' | 'down' | 'flat' } }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 h-4 text-[10px] font-semibold shrink-0',
      delta.direction === 'up'   && 'bg-success-50 text-success-700',
      delta.direction === 'down' && 'bg-danger-50 text-danger-700',
      delta.direction === 'flat' && 'bg-slate-100 text-slate-500',
    )}>
      <span aria-hidden>{delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}</span>
      {delta.value}
    </span>
  );
}

function InsightItem({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col justify-center gap-0.5 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 leading-none whitespace-nowrap">{label}</p>
      <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[160px]">{children ?? value}</p>
    </div>
  );
}
