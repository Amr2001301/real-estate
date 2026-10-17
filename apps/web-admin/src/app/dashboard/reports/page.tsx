import {
  CircleDollarSign,
  FileText,
  TrendingUp,
  Wallet,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { projectOptions } from '@/lib/options';
import { compactParts, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumPanel,
  PremiumEmptyNote,
  PremiumBars,
} from '@/components/premium';
import { NumCell } from '@/components/premium/data-table';
import { ExportMenu } from '@/components/export-menu';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportsTabs } from './_components/reports-tabs';
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

// ── Status maps ────────────────────────────────────────────────────────────────
// U5: sage for confirmed / approved, gold for converted, a darker gold for pending.
const RESERVATION_COLOR: Record<string, string> = {
  CONFIRMED: '#9FBFAB',
  APPROVED:  '#9FBFAB',
  CONVERTED: '#C79A3B',
  PENDING:   '#E2C98F',
  CANCELLED: '#B8B2A3',
  EXPIRED:   '#D9D3C4',
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
  const symbol = currencySymbol(currency, locale);
  const numCell = (v: number) => {
    const [value, unit] = compactParts(v, symbol, locale);
    return { value, unit };
  };
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
    safe(projectOptions()),
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

  const monthNames = trendData.map((d) => d.label);
  const peak = bestTrendMonth && bestTrendMonth.contracts > 0 ? bestTrendMonth : null;
  const [salesNum, salesUnit] = compactParts(salesTotal, symbol, locale);
  const [colNum, colUnit] = compactParts(financialTotal, symbol, locale);
  const delta = (d: ReturnType<typeof computeDelta> | undefined, prefix = '') =>
    d ? `${d.direction === 'up' ? '▲' : d.direction === 'down' ? '▼' : '•'} ${prefix}${d.value}` : undefined;
  const deltaCls = (d: ReturnType<typeof computeDelta> | undefined) =>
    d?.direction === 'up' ? 'success' : d?.direction === 'down' ? 'danger' : undefined;

  const funnelStages = funnel
    ? [
        { label: m.funnel.stages.leads, value: funnel.leads },
        { label: m.funnel.stages.visits, value: funnel.visits, conv: pctStr(funnel.visits, funnel.leads) },
        { label: m.funnel.stages.reservations, value: funnel.reservations, conv: pctStr(funnel.reservations, funnel.visits) },
        { label: m.funnel.stages.contracts, value: funnel.contracts, conv: pctStr(funnel.contracts, funnel.reservations) },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelStages.map((f) => f.value));

  return (
    <div className="flex flex-col gap-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          <ExportMenu
            locale={locale}
            label={m.exportAll}
            groups={[
              { label: m.exportSales, filenameBase: 'sales-report', xlsxPath: '/reports/sales/export.xlsx', pdfPath: '/reports/sales/export.pdf', csvPath: '/reports/sales/export.csv', params: exportParams },
              { label: m.exportFinancial, filenameBase: 'financial-report', xlsxPath: '/reports/financial/export.xlsx', pdfPath: '/reports/financial/export.pdf', csvPath: '/reports/financial/export.csv', params: exportParams },
              { label: m.exportBrokers, filenameBase: 'broker-report', pdfPath: '/reports/broker-leaderboard/export.pdf', params: exportParams },
              { label: m.exportOperational, filenameBase: 'operational-report', pdfPath: '/reports/operational/export.pdf', xlsxPath: '/reports/operational/export.xlsx', csvPath: '/reports/operational/export.csv' },
            ]}
          />
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

      {/* The navy band: four figures, no empty cards (U5). */}
      <PremiumMetricStrip
        cols={4}
        metrics={[
          {
            label: m.kpi.totalSales, icon: <Wallet />, value: salesNum, unit: salesUnit,
            sub: `${contractsCount} ${m.salesTrend.contractSuffix}`,
            trend: delta(salesDelta), trendCls: deltaCls(salesDelta),
          },
          {
            label: m.kpi.contractsSigned, icon: <FileText />, value: contractsCount, unit: m.salesTrend.contractSuffix,
            sub: contractsCount > 0 ? `${m.kpi.avgPrefix} ${compactParts(avgContract, symbol, locale).join(' ')}` : undefined,
            trend: delta(contractsDelta), trendCls: deltaCls(contractsDelta),
          },
          {
            label: m.kpi.collected, icon: <CircleDollarSign />, value: colNum, unit: colUnit,
            sub: `${depositsCount} ${m.kpi.depositSuffix} · ${verifiedCount} ${m.kpi.verifiedSuffix}`,
            trend: delta(financialDelta), trendCls: deltaCls(financialDelta),
          },
          {
            label: m.kpi.conversionRate, icon: <TrendingUp />, value: overallConvStr ? overallConvRate : 0, unit: '%',
            sub: m.kpi.conversionSub,
          },
        ]}
      />

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
        <PremiumPanel
          className="lg:col-span-3"
          title={m.salesTrend.title}
          sub={m.u5.countDesc(year)}
          trailing={
            peak ? (
              <div className="text-end">
                <p className="text-[12px] text-slate-500">{m.u5.peak}</p>
                <p className="text-[14px] font-bold text-slate-900">
                  {peak.label} · <span className="num text-[17px]">{peak.contracts}</span> {m.salesTrend.contractSuffix}
                </p>
              </div>
            ) : undefined
          }
        >
          {trendData.length === 0 ? (
            <PremiumEmptyNote>{m.salesTrend.noDataMsg}</PremiumEmptyNote>
          ) : (
            <PremiumBars
              data={trendData.map((d) => ({ label: d.label, value: d.contracts }))}
              highlight={highlightMonths.map((mo) => mo - 1).filter((i) => i >= 0 && i < monthNames.length)}
            />
          )}
        </PremiumPanel>

        <PremiumPanel
          className="lg:col-span-2"
          title={m.funnel.title}
          sub={m.kpi.conversionSub}
          trailing={
            <span className="rounded-full border border-brand-400/50 px-3 py-1 text-[12px] font-bold text-brand-700">
              {m.u5.overall(overallConvStr ?? '0%')}
            </span>
          }
        >
          {funnelStages.length === 0 ? (
            <PremiumEmptyNote>{m.funnel.empty.description}</PremiumEmptyNote>
          ) : (
            <div>
              {funnelStages.map((st, i) => (
                <div key={st.label}>
                  {i > 0 && (
                    <p className="flex items-center gap-1 py-2 text-[12px] text-slate-500">
                      <ArrowDown className="h-3 w-3" aria-hidden />
                      {st.conv ?? '—'} {m.funnel.fromPrev}
                    </p>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-[15px] font-bold text-slate-900">{st.label}</span>
                    <span className="num text-[24px] font-semibold text-slate-900">{st.value}</span>
                  </div>
                  <div className="mt-1.5 h-[5px] rounded-full bg-surface-sunken">
                    <div className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]" style={{ width: `${(st.value / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumPanel>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <PremiumPanel
          title={m.reservationStatus.title}
          sub={m.reservationStatus.description}
          trailing={
            <span className="inline-flex items-baseline gap-1">
              <span className="num text-[28px] font-semibold text-slate-900">{reservationTotal}</span>
              <span className="text-[12px] text-slate-500">{m.reservationStatus.reservationSuffix}</span>
            </span>
          }
        >
          {reservationEntries.length === 0 ? (
            <PremiumEmptyNote>{m.u5.bookingsEmpty}</PremiumEmptyNote>
          ) : (
            <>
              <div className="flex h-2 gap-1" role="img" aria-label={reservationEntries.map(([st, c]) => `${RESERVATION_STATUS_LABEL[st] ?? st} ${c}`).join('، ')}>
                {reservationEntries.map(([st, c]) =>
                  Number(c) > 0 ? (
                    <span key={st} className="rounded-full" style={{ flexGrow: Number(c), flexBasis: 0, background: RESERVATION_COLOR[st] ?? '#B8B2A3' }} />
                  ) : null,
                )}
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-600">
                {reservationEntries.map(([st, c]) => (
                  <li key={st} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: RESERVATION_COLOR[st] ?? '#B8B2A3' }} aria-hidden />
                    {RESERVATION_STATUS_LABEL[st] ?? st}
                    <span className="num text-[18px] font-semibold text-slate-900">{c}</span>
                    <span className="text-slate-500">· {pct(Number(c), reservationTotal)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PremiumPanel>

        {/* Highlights: one card split by hairlines (U5). */}
        <PremiumPanel title={m.u5.highlightsTitle} sub={m.u5.periodSub(year)} padding="none">
          <dl className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline">
            {[
              { label: m.insights.bestMonth, value: peak ? `${peak.label} · ${peak.contracts} ${m.salesTrend.contractSuffix}` : null },
              { label: m.insights.bestProject, value: topProject?.name ?? null },
              { label: m.insights.topBroker, value: brokers[0]?.brokerName ?? null },
              { label: m.u5.collectionFromSales, value: salesTotal > 0 ? `${Math.round((financialTotal / salesTotal) * 100)}%` : null },
            ].map((h) => (
              <div key={h.label} className="bg-surface px-6 py-5">
                <dt className="text-[13px] text-slate-500">{h.label}</dt>
                <dd className={cn('mt-1 truncate text-[16px] font-bold', h.value ? 'text-slate-900' : 'text-slate-500')}>
                  {h.value ?? m.insights.noData}
                </dd>
              </div>
            ))}
          </dl>
        </PremiumPanel>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <PremiumPanel title={m.projectRankings.title} sub={m.projectRankings.description}>
          {byProject.length === 0 ? (
            <PremiumEmptyNote>{m.u5.projectsEmpty}</PremiumEmptyNote>
          ) : (
            <ol className="space-y-3">
              {byProject.map((p, idx) => (
                <li key={p.projectId} className="flex items-center gap-3">
                  <Rank n={idx + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[15px] font-bold text-slate-900">
                      {projectMap.get(p.projectId) ?? m.projectRankings.unknownProject}
                    </span>
                    <span className="block text-[12px] text-slate-500">
                      {p.count} {m.projectRankings.contractSuffix} · {pct(Number(p.total), salesTotal)}%
                    </span>
                  </span>
                  <NumCell {...numCell(Number(p.total))} />
                </li>
              ))}
            </ol>
          )}
        </PremiumPanel>

        <PremiumPanel title={m.brokerLeaderboard.title} sub={m.brokerLeaderboard.description}>
          {brokers.length === 0 ? (
            <PremiumEmptyNote>{m.u5.brokersEmpty}</PremiumEmptyNote>
          ) : (
            <ol className="space-y-3">
              {brokers.map((b, idx) => (
                <li key={b.brokerId} className="flex items-center gap-3">
                  <Rank n={idx + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-bold text-slate-900">{b.brokerName}</span>
                    <span className="block text-[12px] text-slate-500">
                      {b.count} {m.brokerLeaderboard.commissionSuffix} · {pct(b.commissionAmount, totalCommissions)}%
                    </span>
                  </span>
                  <NumCell {...numCell(b.commissionAmount)} />
                </li>
              ))}
            </ol>
          )}
        </PremiumPanel>
      </div>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={cn(
        'num inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-semibold',
        n === 1 ? 'border-brand-400/70 text-brand-700' : 'border-hairline text-slate-600',
      )}
    >
      {n}
    </span>
  );
}
