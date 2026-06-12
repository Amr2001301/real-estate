import type { ReactNode } from 'react';
import {
  BarChart2,
  BarChart3,
  BookmarkCheck,
  CheckCircle2,
  DollarSign,
  FileBarChart,
  FileText,
  Lightbulb,
  TrendingUp,
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
interface ProjectOption { id: string; name: { ar: string; en: string } }
interface PagedProjects { data: ProjectOption[] }

// ── Reservation labels / tones ────────────────────────────────────────────────
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

// Quarter → highlight month sets (1-indexed)
const Q_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12],
};

// ── Page search params ────────────────────────────────────────────────────────
interface Search {
  mode?: string;
  month?: string;
  year?: string;
  quarter?: string;
  dateFrom?: string;
  dateTo?: string;
  compare?: string;
  projectId?: string;
  period?: string;   // legacy
}

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

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

  const [salesRes, financialRes, reservationsRes, trendRes, projectsRes, cmpSalesRes, cmpFinancialRes] =
    await Promise.all([
      safe(api.get<Sales>(`/reports/sales?${qs}`)),
      safe(api.get<Financial>(`/reports/financial?${qs}`)),
      safe(api.get<Record<string, number>>(`/reports/reservations?${qs}`)),
      safe(api.get<SalesTrendPoint[]>(`/reports/sales-trend?year=${year}`)),
      safe(api.get<PagedProjects>('/projects?pageSize=100')),
      cmpRange
        ? safe(api.get<Sales>(`/reports/sales?dateFrom=${cmpRange.dateFrom}&dateTo=${cmpRange.dateTo}`))
        : Promise.resolve({ data: null, error: null }),
      cmpRange
        ? safe(api.get<Financial>(`/reports/financial?dateFrom=${cmpRange.dateFrom}&dateTo=${cmpRange.dateTo}`))
        : Promise.resolve({ data: null, error: null }),
    ]);

  // ── Derived values ──────────────────────────────────────────────────────────
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

  const trendData        = trendRes.data ?? [];
  const reservationEntries = Object.entries(reservationsRes.data ?? {})
    .sort(([, a], [, b]) => Number(b) - Number(a));

  // Best month from trend data
  const bestTrendMonth = trendData.length > 0
    ? trendData.reduce((best, d) => d.contracts > best.contracts ? d : best, trendData[0]!)
    : null;

  // Top project
  const topProject = byProject[0]
    ? { name: projectMap.get(byProject[0].projectId) ?? 'غير معروف', total: byProject[0].total }
    : null;

  // Comparison deltas
  const salesDelta = cmpSalesRes?.data
    ? computeDelta(salesTotal, Number(cmpSalesRes.data.total ?? 0))
    : undefined;
  const contractsDelta = cmpSalesRes?.data
    ? computeDelta(contractsCount, cmpSalesRes.data.contracts ?? 0)
    : undefined;
  const financialDelta = cmpFinancialRes?.data
    ? computeDelta(financialTotal, Number(cmpFinancialRes.data.total ?? 0))
    : undefined;

  // Highlight months for trend chart
  const highlightMonths =
    mode === 'monthly'   ? [month]               :
    mode === 'quarterly' ? (Q_MONTHS[quarter] ?? []) :
    mode === 'yearly'    ? []                    :
                           [];

  // Export params
  const exportParams: Record<string, string> = { dateFrom, dateTo };

  const anyError = salesRes.error || financialRes.error || reservationsRes.error;

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
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

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <ReportsTabs active="sales" />

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
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

      {/* ── Error ─────────────────────────────────────────────────────────── */}
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

          {/* Primary metric */}
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

          {/* Supporting stats */}
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
          </div>
        </div>
      </div>

      {/* Supporting KPI cards — 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecondaryKpiCard
          icon={<DollarSign className="h-4 w-4 text-slate-500" />}
          label="الدفعات المسجلة"
          value={<span dir="ltr">{formatCurrency(financialTotal)}</span>}
          note={`${depositsCount} دفعة مسجّلة`}
          delta={financialDelta}
        />
        <SecondaryKpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />}
          label="المتحقق منها"
          value={verifiedCount.toLocaleString('ar-EG')}
          note="دفعة موثّقة ومؤكدة"
        />
        <SecondaryKpiCard
          icon={<BarChart2 className="h-4 w-4 text-slate-500" />}
          label="متوسط قيمة العقد"
          value={<span dir="ltr">{formatCurrency(avgContract)}</span>}
          note={contractsCount > 0 ? `محسوب من ${contractsCount} عقد` : 'لا توجد عقود'}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Trend & Reservations
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<TrendingUp />} label="اتجاه المبيعات والحجوزات" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* Sales trend — wider */}
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex items-start gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 mt-0.5">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">اتجاه المبيعات</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                أداء المبيعات شهريًا خلال {year}
              </p>
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

        {/* Reservation status — narrower */}
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
                    <tr
                      key={status}
                      className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors"
                    >
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
          SECTION 3 — Project Performance
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<BarChart3 />} label="أداء المشاريع" />

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <FileBarChart className="h-3.5 w-3.5" />
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
                    <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap w-[200px]">النسبة من الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map((p, idx) => {
                    const pct = salesTotal > 0
                      ? ((Number(p.total) / salesTotal) * 100)
                      : 0;
                    const pctStr = pct.toFixed(1);
                    return (
                      <tr
                        key={p.projectId}
                        className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors"
                      >
                        <td className="py-3 ps-5 pe-4">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-2xs font-bold tabular-nums leading-none shrink-0',
                              idx === 0 ? 'text-brand-600' : 'text-slate-400',
                            )}>
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {projectMap.get(p.projectId) ?? (
                                <span className="text-slate-400 font-normal">غير معروف</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                          {p.count} عقد
                        </td>
                        <td className="py-3 px-4 font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="py-3 ps-4 pe-5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs tabular-nums text-slate-600 w-10 shrink-0 text-end">
                              {pctStr}%
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[120px]">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  idx === 0 ? 'bg-brand-500' : 'bg-brand-300/70',
                                )}
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
          SECTION 4 — Operational Insights (derived, no extra API)
      ════════════════════════════════════════════════════════════════════ */}
      {(contractsCount > 0 || reservationEntries.length > 0) && (
        <div className="flex flex-wrap items-stretch gap-3 rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-xs">

          {/* Strip label */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              ملخص تشغيلي
            </span>
          </div>

          <div className="w-px bg-hairline self-stretch hidden sm:block" />

          {topProject && (
            <InsightItem label="أعلى مشروع مبيعًا" value={topProject.name} />
          )}
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
          {reservationEntries[0] && (
            <>
              <div className="w-px bg-hairline self-stretch hidden sm:block" />
              <InsightItem
                label="أعلى حالة حجز"
                value={`${RESERVATION_STATUS_LABEL[reservationEntries[0][0]] ?? reservationEntries[0][0]} — ${Number(reservationEntries[0][1]).toLocaleString('ar-EG')}`}
              />
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
    <div className="flex items-center gap-2 pt-1">
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 text-slate-400 shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

function StatBlock({
  label,
  delta,
  children,
}: {
  label: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 leading-none shrink-0">
          {label}
        </p>
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
      <span aria-hidden>
        {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'}
      </span>
      {delta.value}
    </span>
  );
}

function SecondaryKpiCard({
  icon,
  label,
  value,
  note,
  delta,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
}) {
  return (
    <div className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-4 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">{label}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className="text-xl font-bold tabular-nums text-slate-900 whitespace-nowrap leading-tight">{value}</p>
          {delta && <DeltaChip delta={delta} />}
        </div>
        {note && <p className="text-2xs text-slate-400 mt-0.5 leading-tight">{note}</p>}
      </div>
      <div className="h-9 w-9 rounded-xl bg-surface-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
    </div>
  );
}

function InsightItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center gap-0.5 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 leading-none whitespace-nowrap">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[160px]">
        {children ?? value}
      </p>
    </div>
  );
}
