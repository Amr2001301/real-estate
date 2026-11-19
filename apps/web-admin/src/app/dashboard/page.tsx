import { Plus, AlertCircle } from 'lucide-react';
import { activityActionLabel, monthChartLabel } from '@/lib/activity-labels';
import { FollowUpsPanel } from '@/components/crm/follow-ups-panel';
import { redirect } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getSession, isBrokerage } from '@/lib/session';
import { getDisabledFeatures } from '@/lib/capabilities';
import { compactParts, intlLocale, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone } from '@/lib/currency';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { ExportMenu } from '@/components/export-menu';
import { groupActivity } from '@/components/dashboard/admin-panels';
import {
  ActionTiles,
  ActivityPanelV2,
  CashFlowV2,
  FinancialHealthV2,
  FunnelV2,
  HeroAction,
  HeroV2,
  LeadSourcesV2,
  LeaderboardV2,
  MonthlyBarsV2,
  ProjectHealthV2,
} from '@/components/dashboard/admin-home';

import { SalesDashboard } from './_components/sales-home';
import { BrokerageDashboard } from './_components/brokerage-home';
import { SalesManagerDashboard } from './_components/sales-manager-home';
import type { Paged, Project, TopBrokersResponse } from '@/lib/types';
import { AiUsageCard, type AiUsage } from '@/components/ai/ai-usage-card';

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
  /** Signed contracts' value split, as on the financial report. */
  portfolio?: {
    grossValue: number;
    netValue: number;
    paid: number;
    awaiting: number;
    overdue: number;
    overdueCount: number;
    notYetDue: number;
    unscheduled: number;
    unsignedCount: number;
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
    /** Unsigned contracts whose first payment has already fallen due. */
    contractsDueBeforeSigning?:  number;
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

/** The greeting and the date line, on the company's time (its time zone setting). */
function greetingAndDate(locale: Locale, m: ReturnType<typeof uiT>['pages']['dashboard'], timeZone: string) {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now));
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone,
  }).format(now);
  return { greeting: hour < 12 ? m.u5.greetingMorning : m.u5.greetingEvening, date };
}

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const session = await getSession();
  // ?day=YYYY-MM-DD picks the agenda day on the sales homes; anything else reads as today.
  const { day } = await searchParams;
  // The platform owner has no company: its home is the platform page (the
  // sidebar logo and breadcrumbs link here).
  if (session?.role === 'SUPER_ADMIN') redirect('/dashboard/super-admin');
  // BRK-1: a brokerage company's home is its pipeline, whatever the role.
  if (isBrokerage(session)) return <BrokerageDashboard day={day} />;
  if (session?.role === 'SALES')         return <SalesDashboard userId={session.id} day={day} />;
  if (session?.role === 'SALES_MANAGER') return <SalesManagerDashboard day={day} />;

  const [currency, locale, disabledFeatures] = await Promise.all([
    getReportsCurrency(),
    getLocale(),
    session ? getDisabledFeatures(session.role) : Promise.resolve(new Set<string>()),
  ]);
  const m      = uiT(locale).pages.dashboard;
  const symbol = currencySymbol(currency, locale);
  const money  = { symbol, locale };
  const now    = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [r, topSalesRes, topBrokersRes, aiUsageRes, projectsRes] = await Promise.all([
    safe(api.get<AdminSummary>('/reports/admin-summary')),
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<TopBrokersResponse>('/broker-reports/top-brokers?limit=5&metric=salesGross')),
    // The AI assistant package — shown only when enabled for the company.
    session?.role === 'ADMIN' ? safe(api.get<AiUsage>('/ai/usage')) : Promise.resolve({ data: null }),
    // The project rows show each project's cover photo and city (from the projects list).
    safe(api.get<Paged<Project>>('/projects?pageSize=100')),
  ]);

  const summary = r.data;
  const error   = r.error;
  const kpis    = summary?.kpis;
  const fin     = summary?.financial;
  const { greeting, date } = greetingAndDate(locale, m, await getCompanyTimeZone());

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
        id: it.id, type: it.type, who: it.title, action: activityActionLabel(it.type, it.action, locale), ref: it.context,
        when: relativeTime(it.createdAt, m), href: activityHref(it.type, rawId), amount: it.amount,
      };
    }),
    m.u5.groupedPayments,
  ).slice(0, 7);

  // Signed contracts against last month, as a chip; nothing when both are 0.
  function monthChip(now: number, prev: number): { trend?: string; tone?: 'success' | 'danger' | 'neutral' } {
    if (now === 0 && prev === 0) return {};
    const d = now - prev;
    if (d === 0) return { trend: m.u5.monthSame, tone: 'neutral' };
    return { trend: m.monthDeltaSign(d), tone: d > 0 ? 'success' : 'danger' };
  }

  const funnel = summary?.funnel;
  const topProjects = summary?.topProjects ?? [];
  const forecast = summary?.cashflowForecast;
  // Overdue is one figure on the page: towards the price, fees out.
  const forecastTotal = forecast ? forecast.next30 + forecast.next3160 + forecast.next6190 + overdue : 0;

  const projectInfo = new Map(
    (projectsRes.data?.data ?? []).map((p) => [p.id, { cover: p.media?.[0]?.url, city: p.city, name: tx(p.name, locale) }]),
  );
  // The hero shows the leading project's photo; a bundled architectural photo without one.
  const heroImage = topProjects.map((p) => projectInfo.get(p.id)?.cover).find(Boolean) ?? '/images/dashboard-hero.jpg';

  return (
    <div className="dash-v2 flex flex-col gap-6">
      <HeroV2
        eyebrow={date}
        title={greeting}
        description={m.description}
        image={heroImage}
        actions={
          <>
            <ExportMenu
              locale={locale}
              label={m.exportReport}
              pdfPath="/reports/admin-summary/export.pdf"
              xlsxPath="/reports/admin-summary/export.xlsx"
              filenameBase="dashboard-report"
              buttonClassName="h-11 rounded-full border-white/25 bg-white/10 text-[#F7F3EA] backdrop-blur-md hover:border-white/40 hover:bg-white/15 hover:text-[#F7F3EA]"
            />
            <HeroAction href="/dashboard/reservations/new" icon={<Plus />}>{m.u5.newBooking}</HeroAction>
            <HeroAction href="/dashboard/deposits/new" icon={<Plus />} gold>{m.u5.recordPayment}</HeroAction>
          </>
        }
        metrics={
          summary
            ? [
                {
                  label: m.kpi.totalContracts, value: totalNum, unit: totalUnit, sub: m.kpi.totalContractsSub,
                  bar: total > 0 ? Math.round((collected / total) * 100) : undefined,
                  barLabel: total > 0 ? m.u5.collectedShare(Math.round((collected / total) * 100)) : undefined,
                },
                {
                  label: m.u5.collected, value: colNum, unit: colUnit,
                  sub: fees > 0 ? m.u5.feesSub(compactParts(fees, symbol, locale).join(' ')) : undefined,
                  trend: collectionDelta !== null ? m.deltaLabel(collectionDelta) : undefined,
                  tone: collectionDelta !== null && collectionDelta >= 0 ? 'success' : 'danger',
                },
                {
                  // The rate, its bar and a short status: the ring and the
                  // two-line note crowded this one column.
                  label: m.kpi.collectionRate, value: rate !== null ? rate : '—', unit: rate !== null ? '%' : '',
                  bar: rate ?? undefined, sub: rate !== null ? m.u5.rateSub : rateNote,
                  trend: rate === null ? undefined : rate >= 90 ? m.u5.rateHealthy : rate >= 70 ? m.u5.rateWatch : m.u5.rateLowChip,
                  tone: rate === null ? undefined : rate >= 90 ? 'success' : rate >= 70 ? 'warning' : 'danger',
                },
                {
                  label: m.kpi.overdue, value: ovNum, unit: ovUnit, sub: overdue > 0 ? m.overdueExceeded : m.kpi.overdueNone,
                  trend: overdue > 0 && summary.portfolio?.overdueCount ? m.u5.overdueContracts(summary.portfolio.overdueCount) : undefined,
                  tone: 'danger',
                },
                {
                  label: m.kpi.monthContracts, value: fin?.signedContractsThisMonth ?? 0,
                  sub: kpis ? m.monthContractsSub(kpis.soldUnits, kpis.reservedUnits) : undefined,
                  ...monthChip(fin?.signedContractsThisMonth ?? 0, fin?.prevMonthSignedContracts ?? 0),
                },
              ]
            : []
        }
      />

      {error && (
        <div className="rounded-card bg-warning-50 border border-warning-100 text-warning-700 p-4 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{m.errorTitle}</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{error}</p>
          </div>
        </div>
      )}

      <ActionTiles
        title={m.actionBar.header}
        allClear={m.actionBar.allClear}
        items={[
          // Customers' payment proofs come first: money waiting on the admin.
          { key: 'payments', label: m.actionBar.pendingProofs, value: summary?.alerts.depositsPendingReview ?? 0, href: '/dashboard/payments/review', icon: 'payments' },
          {
            key: 'contracts',
            label: m.actionBar.pendingContracts,
            value: summary?.alerts.contractsAwaitingSignature ?? 0,
            href: '/dashboard/contracts?signed=no',
            icon: 'contracts',
            // Their first payment is due and nothing chases it until signing.
            note: summary?.alerts.contractsDueBeforeSigning
              ? m.actionBar.dueBeforeSigning(summary.alerts.contractsDueBeforeSigning)
              : undefined,
          },
          // Off the plan, maintenance has no page to open (F36).
          ...(disabledFeatures.has('feature.maintenance')
            ? []
            : [{ key: 'maintenance', label: m.actionBar.openMaintenance, value: summary?.alerts.openMaintenance ?? 0, href: '/dashboard/maintenance', icon: 'maintenance' as const }]),
          { key: 'visits', label: m.actionBar.pendingVisits, value: summary?.alerts.visitsAwaitingConfirmation ?? 0, href: '/dashboard/visits', icon: 'visits' },
          { key: 'requests', label: m.actionBar.openLeads, value: summary?.alerts.infoRequestsOpen ?? 0, href: '/dashboard/requests', icon: 'requests' },
        ]}
      />

      <FollowUpsPanel locale={locale} variant="wide" />

      <AiUsageCard usage={aiUsageRes.data ?? null} locale={locale} />

      {/* Two columns of one height: the bars stretch to meet the leaderboards. */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ActivityPanelV2
            title={m.activityFeed.title}
            sub={m.activityCount(summary?.recentActivity.length ?? 0)}
            link={{ href: '/dashboard/audit', label: m.viewAllFull }}
            empty={m.activityFeed.empty}
            items={activity}
            money={money}
          />
          <MonthlyBarsV2
            title={m.charts.reservationTrend}
            sub={m.charts.reservationDesc}
            empty={m.charts.empty}
            data={(summary?.reservationTrend ?? []).map((t) => ({ label: monthChartLabel(t.month, t.label, locale), value: t.value }))}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <LeaderboardV2
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
          <LeaderboardV2
            className="flex-1"
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

      {(topProjects.length > 0 || funnel) && (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {topProjects.length > 0 && (
            <ProjectHealthV2
              title={m.projectHealth.title}
              sub={`${topProjects.length} ${m.projectHealth.activeSuffix}`}
              link={{ href: '/dashboard/projects', label: m.projectHealth.viewAll }}
              labels={m.u5.projects}
              money={money}
              projects={topProjects.map((p) => ({
                id: p.id, name: projectInfo.get(p.id)?.name || p.name, city: projectInfo.get(p.id)?.city, cover: projectInfo.get(p.id)?.cover,
                sold: p.soldUnits, reserved: p.reservedUnits, available: p.availableUnits,
                signed: p.signedContracts, value: p.contractValue,
              }))}
            />
          )}
          {funnel && (
            <FunnelV2
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
      )}

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {fin && (
          <FinancialHealthV2
            title={m.u5.healthTitle}
            sub={m.u5.healthSub}
            total={total}
            collected={collected}
            overdue={overdue}
            fees={fees}
            portfolio={summary?.portfolio}
            labels={m.u5.health}
            money={money}
          />
        )}
        <LeadSourcesV2
          title={m.charts.leadSources}
          sub={m.charts.leadSourcesDesc}
          centerSub={m.charts.donutSub}
          empty={m.charts.empty}
          slices={(summary?.leadSources ?? []).map((s) => ({ label: s.source, value: s.count }))}
          otherLabel={locale === 'en' ? 'Other' : 'أخرى'}
        />
      </div>

      {forecast && (
        <CashFlowV2
          title={m.cashFlow.title}
          sub={<>{m.u5.next90} · {m.cashFlow.totalSub} {compactParts(forecastTotal, symbol, locale).join(' ')}</>}
          link={{ href: '/dashboard/reports/financial', label: m.cashFlow.detailLink }}
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
