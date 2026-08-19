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
  Star,
  Trophy,
  CalendarDays,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { formatCurrency, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PremiumPageHero, PremiumSectionCard, PremiumMetricStrip } from '@/components/premium';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/export-menu';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportsTabs } from './_components/reports-tabs';
import { SalesTrendChart } from './_components/sales-trend-chart';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

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
const RESERVATION_STATUS_TONE: Record<string, BadgeTone> = {
  PENDING:   'warning',
  CONFIRMED: 'success',
  APPROVED:  'success',
  CONVERTED: 'brand',
  CANCELLED: 'danger',
  EXPIRED:   'gray',
};
const RESERVATION_BAR_COLOR: Record<string, string> = {
  CONFIRMED: 'bg-emerald-500',
  APPROVED:  'bg-emerald-400',
  CONVERTED: 'bg-brand-500',
  PENDING:   'bg-amber-400',
  CANCELLED: 'bg-slate-300',
  EXPIRED:   'bg-slate-200',
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
  const [currency, locale] = await Promise.all([getReportsCurrency(), getLocale()]);
  const m = uiT(locale).pages.reports;

  const RESERVATION_STATUS_LABEL: Record<string, string> = {
    PENDING:   m.reservationStatus.statusLabels.PENDING,
    CONFIRMED: m.reservationStatus.statusLabels.CONFIRMED,
    APPROVED:  m.reservationStatus.statusLabels.APPROVED,
    CONVERTED: m.reservationStatus.statusLabels.CONVERTED,
    CANCELLED: m.reservationStatus.statusLabels.CANCELLED,
    EXPIRED:   m.reservationStatus.statusLabels.EXPIRED,
  };

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

  const reservationEntries = Object.entries(reservationsRes.data ?? {}).sort(([ ,a], [ ,b]) => Number(b) - Number(a));
  const reservationTotal   = reservationEntries.reduce((s, [, c]) => s + Number(c), 0);

  const bestTrendMonth = trendData.length > 0
    ? trendData.reduce((best, d) => d.contracts > best.contracts ? d : best, trendData[0]!)
    : null;

  const topProject = byProject[0]
    ? { name: projectMap.get(byProject[0].projectId) ?? m.projectRankings.unknownProject, total: byProject[0].total, count: byProject[0].count }
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

  // Funnel stages
  const funnelStages = funnel ? [
    { label: m.funnel.stages.leads,        icon: UserPlus,      value: funnel.leads,        color: 'bg-brand-500',   labelColor: 'text-brand-700',   conv: null,                                            pctOfLeads: 100 },
    { label: m.funnel.stages.visits,       icon: MapPin,        value: funnel.visits,       color: 'bg-blue-500',    labelColor: 'text-blue-700',    conv: pctStr(funnel.visits, funnel.leads),             pctOfLeads: pct(funnel.visits, funnel.leads) },
    { label: m.funnel.stages.reservations, icon: BookmarkCheck, value: funnel.reservations, color: 'bg-violet-500',  labelColor: 'text-violet-700',  conv: pctStr(funnel.reservations, funnel.visits),      pctOfLeads: pct(funnel.reservations, funnel.leads) },
    { label: m.funnel.stages.contracts,    icon: FileText,      value: funnel.contracts,    color: 'bg-emerald-500', labelColor: 'text-emerald-700', conv: pctStr(funnel.contracts, funnel.reservations),   pctOfLeads: pct(funnel.contracts, funnel.leads) },
  ] : [];

  return (
    <div className="space-y-4">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportMenu label={m.exportSales}       xlsxPath="/reports/sales/export.xlsx"       pdfPath="/reports/sales/export.pdf"         csvPath="/reports/sales/export.csv"       filenameBase="sales-report"       params={exportParams} />
            <ExportMenu label={m.exportFinancial}   xlsxPath="/reports/financial/export.xlsx"   pdfPath="/reports/financial/export.pdf"     csvPath="/reports/financial/export.csv"   filenameBase="financial-report"   params={exportParams} />
            <ExportMenu label={m.exportBrokers}                                                  pdfPath="/reports/broker-leaderboard/export.pdf"                                     filenameBase="broker-report"      params={exportParams} />
            <ExportMenu label={m.exportOperational} xlsxPath="/reports/operational/export.xlsx"                                             csvPath="/reports/operational/export.csv" filenameBase="operational-report" />
          </div>
        }
      />

      <ReportsTabs active="sales" locale={locale} />
      <ReportFilterBar
        defaultMode={mode as PeriodMode}
        defaultMonth={month}
        defaultYear={year}
        defaultQuarter={quarter}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        defaultCompare={compare}
        basePath="/dashboard/reports"
        locale={locale}
      />

      {anyError && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">{anyError}</div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          METRIC STRIP
      ════════════════════════════════════════════════════════════════════ */}
      <PremiumMetricStrip
        variant="dashboard"
        cols={5}
        metrics={[
          {
            label:     m.kpi.totalSales,
            icon:      <Wallet />,
            value:     formatCurrency(salesTotal, currency),
            tone:      'neutral',
            valueSize: 'compact',
            sub:       `${contractsCount} ${m.salesTrend.contractSuffix}`,
            trend:     salesDelta ? `${salesDelta.direction === 'up' ? '▲' : salesDelta.direction === 'down' ? '▼' : '•'} ${salesDelta.value} ${m.trendCompare}` : undefined,
            trendCls:  salesDelta?.direction === 'up' ? 'text-success-600' : salesDelta?.direction === 'down' ? 'text-danger-600' : undefined,
          },
          {
            label:    m.kpi.contractsSigned,
            icon:     <FileText />,
            value:    contractsCount.toLocaleString('ar-EG'),
            tone:     'neutral',
            sub:      `${m.kpi.avgPrefix} ${formatCurrency(avgContract, currency)}`,
            trend:    contractsDelta ? `${contractsDelta.direction === 'up' ? '▲' : contractsDelta.direction === 'down' ? '▼' : '•'} ${contractsDelta.value}` : undefined,
            trendCls: contractsDelta?.direction === 'up' ? 'text-success-600' : contractsDelta?.direction === 'down' ? 'text-danger-600' : undefined,
          },
          {
            label:     m.kpi.collected,
            icon:      <CircleDollarSign />,
            value:     formatCurrency(financialTotal, currency),
            tone:      'success',
            valueSize: 'compact',
            sub:       `${depositsCount} ${m.kpi.depositSuffix} · ${verifiedCount} ${m.kpi.verifiedSuffix}`,
            trend:     financialDelta ? `${financialDelta.direction === 'up' ? '▲' : financialDelta.direction === 'down' ? '▼' : '•'} ${financialDelta.value}` : undefined,
            trendCls:  financialDelta?.direction === 'up' ? 'text-success-600' : financialDelta?.direction === 'down' ? 'text-danger-600' : undefined,
          },
          {
            label: m.kpi.conversionRate,
            icon:  <TrendingUp />,
            value: overallConvStr ?? '—',
            tone:  overallConvRate >= 50 ? 'success' : overallConvRate >= 25 ? 'warning' : 'purple',
            sub:   m.kpi.conversionSub,
          },
          {
            label: m.kpi.topProject,
            icon:  <Trophy />,
            value: topProject?.name ?? '—',
            tone:  'neutral',
            sub:   topProject ? `${topProject.count} ${m.salesTrend.contractSuffix} · ${formatCurrency(topProject.total, currency)}` : undefined,
          },
        ]}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2 — Monthly Trend (3/5) | Conversion Funnel (2/5)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Monthly Trend */}
        <PremiumSectionCard
          className="lg:col-span-3"
          icon={<BarChart3 />}
          title={m.salesTrend.title}
          description={`${m.salesTrend.descriptionPrefix} ${year}`}
          trailing={
            <div className="text-end">
              <p className="text-base font-black tabular-nums text-slate-900 leading-none">
                {trendData.reduce((s, d) => s + d.contracts, 0).toLocaleString('ar-EG')} {m.salesTrend.contractSuffix}
              </p>
              {bestTrendMonth && bestTrendMonth.contracts > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                  {m.salesTrend.peakLabel} <span className="font-semibold text-slate-700">{bestTrendMonth.label}</span>
                </p>
              )}
            </div>
          }
          padded={false}
        >
          <div className="px-5 py-5">
            <SalesTrendChart data={trendData} highlightMonths={highlightMonths} currency={currency} locale={locale} />
          </div>
        </PremiumSectionCard>

        {/* Conversion Funnel — vertical, proportional bars */}
        <PremiumSectionCard
          className="lg:col-span-2"
          icon={<TrendingUp />}
          title={m.funnel.title}
          trailing={
            overallConvStr
              ? <span className={cn(
                  'inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-black border shrink-0',
                  overallConvRate >= 50 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  overallConvRate >= 25 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-violet-50 border-violet-200 text-violet-700',
                )}>
                  {overallConvStr} {m.funnel.totalSuffix}
                </span>
              : undefined
          }
          padded={false}
        >
          {funnelStages.length === 0 ? (
            <EmptyState icon={<TrendingUp />} title={m.funnel.empty.title} description={m.funnel.empty.description} />
          ) : (
            <div className="px-5 py-5 space-y-0">
              {funnelStages.map((stage, i) => {
                const StageIcon = stage.icon;
                const barWidth = Math.max(stage.pctOfLeads, stage.pctOfLeads > 0 ? 4 : 0);
                return (
                  <div key={stage.label}>
                    {/* Connector with conversion rate */}
                    {i > 0 && (
                      <div className="flex items-center gap-2 py-1.5 ps-[4.5rem]">
                        <ChevronDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                        {stage.conv && (
                          <span className={cn('text-[11px] font-bold', stage.labelColor)}>{stage.conv}</span>
                        )}
                        <span className="text-[10px] text-slate-300">{m.funnel.fromPrev}</span>
                      </div>
                    )}
                    {/* Stage row */}
                    <div className="flex items-center gap-3">
                      {/* Count */}
                      <div className="w-12 shrink-0 text-end">
                        <span className={cn('text-lg font-black tabular-nums leading-none', stage.labelColor)}>
                          {stage.value.toLocaleString('ar-EG')}
                        </span>
                      </div>
                      {/* Bar */}
                      <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden relative">
                        <div
                          className={cn('h-full rounded-lg transition-all', stage.color)}
                          style={{ width: `${barWidth}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2.5">
                          <div className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', barWidth > 40 ? 'text-white' : 'text-slate-600')}>
                            <StageIcon className="h-3 w-3 shrink-0" />
                            {stage.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer transition rates */}
          {funnel && (
            <div className="border-t border-hairline bg-canvas/40 px-5 py-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: m.funnel.transitions.leadVisit,           value: pctStr(funnel.visits, funnel.leads) },
                  { label: m.funnel.transitions.visitReservation,    value: pctStr(funnel.reservations, funnel.visits) },
                  { label: m.funnel.transitions.reservationContract, value: pctStr(funnel.contracts, funnel.reservations) },
                ].map((r) => (
                  <div key={r.label} className="space-y-0.5">
                    <p className={cn('text-[13px] font-black tabular-nums', r.value ? 'text-slate-800' : 'text-slate-300')}>
                      {r.value ?? '—'}
                    </p>
                    <p className="text-[9px] text-slate-400 leading-tight">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PremiumSectionCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 3 — Reservation Status (horizontal stacked bar)
      ════════════════════════════════════════════════════════════════════ */}
      {reservationEntries.length > 0 && (
        <PremiumSectionCard
          icon={<BookmarkCheck />}
          title={m.reservationStatus.title}
          description={m.reservationStatus.description}
          trailing={
            <span className="text-sm font-black tabular-nums text-slate-900 shrink-0">
              {reservationTotal.toLocaleString('ar-EG')} {m.reservationStatus.reservationSuffix}
            </span>
          }
          padded={false}
        >
          <div className="px-5 pt-4 pb-3">
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4">
              {reservationEntries.map(([status, count]) => {
                const w = reservationTotal > 0 ? (Number(count) / reservationTotal) * 100 : 0;
                return w > 0 ? (
                  <div
                    key={status}
                    className={cn('h-full shrink-0', RESERVATION_BAR_COLOR[status] ?? 'bg-slate-200')}
                    style={{ width: `${w}%` }}
                  />
                ) : null;
              })}
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap gap-3">
              {reservationEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', RESERVATION_BAR_COLOR[status] ?? 'bg-slate-200')} />
                  <Badge tone={RESERVATION_STATUS_TONE[status] ?? 'gray'} size="sm">
                    {RESERVATION_STATUS_LABEL[status] ?? status}
                  </Badge>
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {Number(count).toLocaleString('ar-EG')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {reservationTotal > 0 ? `${Math.round((Number(count) / reservationTotal) * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PremiumSectionCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 4 — Project Rankings + Broker Leaderboard (side by side)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Project Rankings */}
        <PremiumSectionCard
          icon={<BarChart3 />}
          title={m.projectRankings.title}
          description={m.projectRankings.description}
          trailing={
            byProject.length > 0
              ? <span className="text-xs text-slate-400 tabular-nums shrink-0">{byProject.length} {m.projectRankings.projectSuffix}</span>
              : undefined
          }
          padded={false}
        >
          {byProject.length === 0 ? (
            <EmptyState icon={<FileText />} title={m.projectRankings.empty.title} description={m.projectRankings.empty.description} />
          ) : (
            <div className="divide-y divide-hairline">
              {byProject.map((p, idx) => {
                const sharePct = salesTotal > 0 ? (Number(p.total) / salesTotal) * 100 : 0;
                const isTop    = idx === 0;
                const name     = projectMap.get(p.projectId) ?? m.projectRankings.unknownProject;
                return (
                  <div key={p.projectId} className={cn('flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/40 transition-colors', isTop && 'bg-amber-50/40')}>
                    <RankBadge rank={idx + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', isTop ? 'bg-amber-400' : 'bg-slate-300')}
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">{sharePct.toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-400">{p.count} {m.projectRankings.contractSuffix}</span>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-black tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                        {formatCurrency(p.total, currency)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PremiumSectionCard>

        {/* Broker Leaderboard */}
        <PremiumSectionCard
          icon={<Users />}
          title={m.brokerLeaderboard.title}
          description={m.brokerLeaderboard.description}
          trailing={
            brokers.length > 0
              ? <span className="text-xs text-slate-400 tabular-nums shrink-0">{brokers.length} {m.brokerLeaderboard.brokerSuffix}</span>
              : undefined
          }
          padded={false}
        >
          {brokers.length === 0 ? (
            <EmptyState icon={<Users />} title={m.brokerLeaderboard.empty.title} description={m.brokerLeaderboard.empty.description} />
          ) : (
            <div className="divide-y divide-hairline">
              {brokers.map((b, idx) => {
                const sharePct = totalCommissions > 0 ? (b.commissionAmount / totalCommissions) * 100 : 0;
                return (
                  <div key={b.brokerId} className={cn('flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/40 transition-colors', idx === 0 && 'bg-amber-50/40')}>
                    <RankBadge rank={idx + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.brokerName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', idx === 0 ? 'bg-amber-400' : idx <= 2 ? 'bg-violet-400' : 'bg-slate-300')}
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">{sharePct.toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-400">{b.count} {m.brokerLeaderboard.commissionSuffix}</span>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-black tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                        {formatCurrency(b.commissionAmount, currency)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PremiumSectionCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 5 — Insights ribbon
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: m.insights.bestMonth,
            icon: <CalendarDays className="h-3.5 w-3.5" />,
            iconBg: 'bg-brand-50 text-brand-600',
            value: bestTrendMonth?.contracts ? bestTrendMonth.label : '—',
            sub:   bestTrendMonth?.contracts ? `${bestTrendMonth.contracts} ${m.salesTrend.contractSuffix}` : m.insights.noData,
          },
          {
            label: m.insights.bestProject,
            icon: <Trophy className="h-3.5 w-3.5" />,
            iconBg: 'bg-amber-50 text-amber-600',
            value: topProject?.name ?? '—',
            sub:   topProject ? `${topProject.count} ${m.salesTrend.contractSuffix}` : m.insights.noData,
          },
          {
            label: m.insights.topBroker,
            icon: <Star className="h-3.5 w-3.5" />,
            iconBg: 'bg-violet-50 text-violet-600',
            value: brokers[0]?.brokerName ?? '—',
            sub:   brokers[0] ? formatCurrency(brokers[0].commissionAmount, currency) : m.insights.noData,
            subDir: 'ltr' as const,
          },
          {
            label: m.insights.salesPayments,
            icon: <ArrowRight className="h-3.5 w-3.5" />,
            iconBg: 'bg-emerald-50 text-emerald-600',
            value: salesTotal > 0 ? `${Math.round((financialTotal / salesTotal) * 100)}%` : '—',
            sub:   m.insights.salesPaymentsSub,
          },
        ].map((item) => (
          <div key={item.label} className="bg-surface rounded-[20px] border border-hairline shadow-soft p-4">
            <div className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg mb-2.5', item.iconBg)}>
              {item.icon}
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">{item.label}</p>
            <p className="text-sm font-bold text-slate-900 mt-1.5 leading-tight truncate">{item.value}</p>
            {item.sub && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate" dir={item.subDir}>{item.sub}</p>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const medal = medals[rank];
  return (
    <div className={cn(
      'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
      rank === 1 ? 'bg-amber-100' : rank <= 3 ? 'bg-slate-100' : 'bg-slate-50',
    )}>
      {medal
        ? <span className="text-base leading-none">{medal}</span>
        : <span className="text-[11px] font-black text-slate-400">{rank}</span>
      }
    </div>
  );
}
