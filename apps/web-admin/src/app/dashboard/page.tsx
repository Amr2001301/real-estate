import { Plus, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { compactParts, intlLocale } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/export-menu';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import {
  ActivityPanel,
  CashFlowPanel,
  FinancialHealthPanel,
  FunnelPanel,
  LeadSourcesPanel,
  LeaderboardPanel,
  MonthlyBarsPanel,
  NeedsActionPanel,
  ProjectHealthPanel,
  groupActivity,
} from '@/components/dashboard/admin-panels';
import { SalesDashboard } from './_components/sales-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';
import type { TopBrokersResponse } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSummary {
  kpis: {
    projects:          number;
    totalUnits:        number;
    availableUnits:    number;
    reservedUnits:     number;
    soldUnits:         number;
    newLeadsThisMonth: number;
    pendingDeposits:   number;
    openMaintenance:   number;
    signedContracts:   number;
    totalCustomers:    number;
    totalTeam:         number;
  };
  funnel?: {
    leads:        number;
    visits:       number;
    reservations: number;
    contracts:    number;
  };
  financial?: {
    totalContractValue:       number;
    totalCollectedVerified:   number;
    /** Collected towards live contracts' price; fees & penalties apart. */
    collectedTowardsPrice?:   number;
    overdueTowardsPrice?:     number;
    feesCollected?:           number;
    /** Booking + payment rows due by today, towards the price (U5). */
    dueToDate?:               number;
    /** Collected against what is due by today — the collection rate's numerator. */
    collectedAgainstDue?:     number;
    overdueTotal:             number;
    pendingBonus:             number;
    pendingBrokerPayouts:     number;
    collectedThisMonth:       number;
    prevMonthCollected:       number;
    signedContractsThisMonth: number;
    prevMonthSignedContracts: number;
    prevMonthNewLeads:        number;
  };
  cashflowForecast?: {
    next30:   number;
    next3160: number;
    next6190: number;
  };
  topProjects?: Array<{
    id:              string;
    name:            string;
    totalUnits:      number;
    availableUnits:  number;
    reservedUnits:   number;
    soldUnits:       number;
    signedContracts: number;
    contractValue:   number;
  }>;
  reservationTrend: Array<{ month: string; label: string; value: number }>;
  leadSources:      Array<{ source: string; count: number }>;
  recentActivity: Array<{
    id:        string;
    type:      string;
    title:     string;
    action:    string;
    context:   string | null;
    createdAt: string;
    amount?:   number;
  }>;
  alerts: {
    contractsAwaitingSignature:  number;
    depositsPendingReview:       number;
    openMaintenance:             number;
    reservationsExpiringSoon:    number;
    visitsAwaitingConfirmation:  number;
    infoRequestsOpen:            number;
  };
}

interface PerformanceRow {
  salesId:              string;
  salesName:            string;
  achievedAmount:       number;
  signedContractsCount: number;
  targetAmountPercent:  number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function activityHref(type: string, id: string): string | undefined {
  switch (type) {
    case 'reservation':  return `/dashboard/reservations/${id}`;
    case 'deposit':      return `/dashboard/deposits/${id}`;
    case 'contract':     return `/dashboard/contracts/${id}`;
    case 'lead':         return `/dashboard/leads/${id}`;
    case 'maintenance':  return `/dashboard/maintenance/${id}`;
    default:             return undefined;
  }
}

function relativeTime(iso: string, m: ReturnType<typeof uiT>['pages']['dashboard']): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.round(diffMs / 60000);
  if (mins < 1)  return m.relativeNow;
  if (mins < 60) return m.relativeMinutes(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return m.relativeHours(hrs);
  return m.relativeDays(Math.round(hrs / 24));
}

function pctDelta(current: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}


// ── Page ──────────────────────────────────────────────────────────────────────

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** The greeting and the date line, on Cairo time (the platform's companies are Egyptian). */
function greetingAndDate(locale: Locale, m: ReturnType<typeof uiT>['pages']['dashboard']) {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(now));
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo',
  }).format(now);
  return { greeting: hour < 12 ? m.u5.greetingMorning : m.u5.greetingEvening, date };
}

export default async function DashboardHome() {
  const session = await getSession();
  if (session?.role === 'SALES')         return <SalesDashboard userId={session.id} />;
  if (session?.role === 'SALES_MANAGER') return <SalesManagerDashboard />;

  const [currency, locale] = await Promise.all([
    getReportsCurrency(),
    getLocale(),
  ]);
  const m      = uiT(locale).pages.dashboard;
  const symbol = currencySymbol(currency, locale);
  const money  = { symbol, locale };
  const now    = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [r, topSalesRes, topBrokersRes] = await Promise.all([
    safe(api.get<AdminSummary>('/reports/admin-summary')),
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<TopBrokersResponse>('/broker-reports/top-brokers?limit=5&metric=salesGross')),
  ]);

  const summary = r.data;
  const error   = r.error;
  const kpis    = summary?.kpis;
  const fin     = summary?.financial;
  const { greeting, date } = greetingAndDate(locale, m);

  // ── Band ──
  const total     = fin?.totalContractValue ?? 0;
  const collected = fin?.collectedTowardsPrice ?? fin?.totalCollectedVerified ?? 0;
  const fees      = fin?.feesCollected ?? 0;
  const overdue   = fin?.overdueTowardsPrice ?? fin?.overdueTotal ?? 0;
  // Collection rate against what is due by today, not the whole contract
  // value (review item 2): most of the value is not due yet.
  // Decided 2026-10-17: the money collected against what is due — a payment
  // ahead of its date does not lift it (it hid arrears behind a 100% cap).
  const due       = fin?.dueToDate;
  const againstDue = fin?.collectedAgainstDue ?? collected;
  const rate      = due !== undefined && due > 0 ? Math.min(100, Math.round((againstDue / due) * 100)) : null;
  const rateNote  =
    rate === null ? m.u5.rateNothingDue : rate >= 90 ? m.u5.rateHealthy : rate >= 70 ? m.u5.rateWatch : m.u5.rateLow;
  const collectionDelta = pctDelta(fin?.collectedThisMonth ?? 0, fin?.prevMonthCollected ?? 0);
  const [totalNum, totalUnit] = compactParts(total, symbol, locale);
  const [colNum, colUnit]     = compactParts(collected, symbol, locale);
  const [ovNum, ovUnit]       = compactParts(overdue, symbol, locale);

  // ── Activity: payments carry their amount; repeats are grouped ──
  const activity = groupActivity(
    (summary?.recentActivity ?? []).map((it) => {
      const rawId = it.id.includes(':') ? it.id.split(':').slice(1).join(':') : it.id;
      return {
        id: it.id, type: it.type, who: it.title, action: it.action, ref: it.context,
        when: relativeTime(it.createdAt, m), href: activityHref(it.type, rawId), amount: it.amount,
      };
    }),
    m.u5.groupedPayments,
  ).slice(0, 7);

  const funnel = summary?.funnel;
  const topProjects = summary?.topProjects ?? [];
  const forecast = summary?.cashflowForecast;
  // Overdue is one figure on the page: towards the price, fees out.
  const forecastTotal = forecast ? forecast.next30 + forecast.next3160 + forecast.next6190 + overdue : 0;

  return (
    <div className="flex flex-col gap-6">
      <PremiumPageHero
        eyebrow={date}
        title={greeting}
        description={m.description}
        actions={
          <>
            <ExportMenu
              locale={locale}
              label={m.exportReport}
              pdfPath="/reports/admin-summary/export.pdf"
              xlsxPath="/reports/admin-summary/export.xlsx"
              csvPath="/reports/admin-summary/export.csv"
              filenameBase="dashboard-report"
            />
            <Link href={'/dashboard/reservations/new' as never}>
              <Button variant="outline" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.u5.newBooking}</Button>
            </Link>
            <Link href={'/dashboard/deposits/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.u5.recordPayment}</Button>
            </Link>
          </>
        }
      >
        {summary && (
          <PremiumMetricStrip
            cols={5}
            metrics={[
              { label: m.kpi.totalContracts, value: totalNum, unit: totalUnit, sub: m.kpi.totalContractsSub },
              {
                label: m.u5.collected, value: colNum, unit: colUnit,
                sub: fees > 0 ? m.u5.feesSub(compactParts(fees, symbol, locale).join(' ')) : undefined,
                trend: collectionDelta !== null ? m.deltaLabel(collectionDelta) : undefined,
                trendCls: collectionDelta !== null && collectionDelta >= 0 ? 'success' : 'danger',
              },
              {
                label: m.kpi.collectionRate, value: rate !== null ? rate : '—', unit: rate !== null ? '%' : '',
                ring: rate ?? undefined, sub: rate !== null ? m.u5.rateSub : rateNote,
                trend: rate !== null ? rateNote : undefined,
                trendCls: rate === null ? undefined : rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger',
              },
              { label: m.kpi.overdue, value: ovNum, unit: ovUnit, sub: overdue > 0 ? m.overdueExceeded : m.kpi.overdueNone },
              {
                label: m.kpi.monthContracts, value: fin?.signedContractsThisMonth ?? 0,
                sub: kpis ? m.monthContractsSub(kpis.soldUnits, kpis.reservedUnits) : undefined,
              },
            ]}
          />
        )}
      </PremiumPageHero>

      {error && (
        <div className="rounded-[18px] bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{m.errorTitle}</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      <NeedsActionPanel
        title={m.actionBar.header}
        allClear={m.actionBar.allClear}
        items={[
          { key: 'contracts', label: m.actionBar.pendingContracts, value: summary?.alerts.contractsAwaitingSignature ?? 0, href: '/dashboard/contracts', icon: 'contracts' },
          { key: 'maintenance', label: m.actionBar.openMaintenance, value: summary?.alerts.openMaintenance ?? 0, href: '/dashboard/maintenance', icon: 'maintenance' },
          { key: 'visits', label: m.actionBar.pendingVisits, value: summary?.alerts.visitsAwaitingConfirmation ?? 0, href: '/dashboard/visits', icon: 'visits' },
          { key: 'requests', label: m.actionBar.openLeads, value: summary?.alerts.infoRequestsOpen ?? 0, href: '/dashboard/requests', icon: 'requests' },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityPanel
            title={m.activityFeed.title}
            sub={m.activityCount(summary?.recentActivity.length ?? 0)}
            link={{ href: '/dashboard/audit', label: m.viewAllFull }}
            empty={m.activityFeed.empty}
            items={activity}
            money={money}
          />
        </div>
        <div className="flex flex-col gap-6">
          <LeaderboardPanel
            title={m.topSales.title}
            sub={m.topSales.sub}
            link={{ href: '/dashboard/sales/performance', label: m.viewAll }}
            empty={m.u5.noSalesThisMonth}
            money={money}
            rows={[...(topSalesRes.data ?? [])]
              .sort((a, b) => b.achievedAmount - a.achievedAmount)
              .slice(0, 5)
              .map((x) => ({ id: x.salesId, name: x.salesName, sub: `${x.signedContractsCount} ${m.topSales.contractSuffix}`, value: x.achievedAmount }))}
          />
          <LeaderboardPanel
            title={m.topBrokers.title}
            sub={m.topBrokers.sub}
            link={{ href: '/dashboard/broker-reports', label: m.viewAll }}
            empty={m.topBrokers.empty}
            money={money}
            rows={(topBrokersRes.data?.data ?? [])
              .slice(0, 5)
              .map((b) => ({ id: b.brokerId, name: b.companyName, sub: `${b.contractsSigned} ${m.topBrokers.contractSuffix}`, value: Number(b.salesGross) }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyBarsPanel
            title={m.charts.reservationTrend}
            sub={m.charts.reservationDesc}
            badge={m.charts.reservationBadge}
            empty={m.charts.empty}
            data={(summary?.reservationTrend ?? []).map((t) => ({ label: t.label, value: t.value }))}
          />
        </div>
        {funnel && (
          <FunnelPanel
            title={m.u5.funnel.title}
            sub={m.u5.funnel.sub}
            footnote={m.u5.funnelNote}
            stages={[
              { label: m.u5.funnel.leads, value: funnel.leads },
              { label: m.u5.funnel.visits, value: funnel.visits },
              { label: m.u5.funnel.reservations, value: funnel.reservations },
              {
                label: m.u5.funnel.contracts,
                value: funnel.contracts,
                // Contracts come from bookings, so this rate means something.
                note: funnel.reservations > 0
                  ? m.u5.funnelConversion(Math.round((funnel.contracts / funnel.reservations) * 100))
                  : undefined,
              },
            ]}
          />
        )}
      </div>

      {topProjects.length > 0 && (
        <ProjectHealthPanel
          title={m.projectHealth.title}
          sub={`${topProjects.length} ${m.projectHealth.activeSuffix}`}
          link={{ href: '/dashboard/projects', label: m.projectHealth.viewAll }}
          labels={m.u5.projects}
          money={money}
          projects={topProjects.map((p) => ({
            id: p.id, name: p.name, sold: p.soldUnits, reserved: p.reservedUnits, available: p.availableUnits,
            signed: p.signedContracts, value: p.contractValue,
          }))}
        />
      )}

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        {fin && (
          <div className="lg:col-span-2">
            <FinancialHealthPanel
              title={m.u5.healthTitle}
              sub={m.u5.healthSub}
              total={total}
              collected={collected}
              overdue={overdue}
              fees={fees}
              labels={m.u5.health}
              money={money}
            />
          </div>
        )}
        <LeadSourcesPanel
          title={m.charts.leadSources}
          sub={m.charts.leadSourcesDesc}
          centerSub={m.charts.donutSub}
          empty={m.charts.empty}
          slices={(summary?.leadSources ?? []).map((s) => ({ label: s.source, value: s.count }))}
        />
      </div>

      {forecast && (
        <CashFlowPanel
          title={m.cashFlow.title}
          sub={<>{m.u5.next90} · {m.cashFlow.totalSub} {compactParts(forecastTotal, symbol, locale).join(' ')}</>}
          link={{ href: '/dashboard/financial-dashboard', label: m.cashFlow.detailLink }}
          pctOfTotal={m.pctOfTotal}
          money={money}
          slots={[
            { label: m.cashFlow.slot30, value: forecast.next30 },
            { label: m.cashFlow.slot60, value: forecast.next3160 },
            { label: m.cashFlow.slot90, value: forecast.next6190 },
            { label: m.cashFlow.slotOverdue, value: overdue, overdue: true },
          ]}
        />
      )}
    </div>
  );
}
