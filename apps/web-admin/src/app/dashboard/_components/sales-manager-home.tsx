import Link from 'next/link';
import {
  Users,
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Banknote,
  AlertCircle,
  AlertTriangle,
  Plus,
  CalendarPlus,
  Wallet,
  ArrowUpRight,
  Bell,
  Star,
  Target,
  Info,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts, formatCompact, formatCurrency, formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { StagePipeline } from '@/components/crm/stage-pipeline';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface PerformanceRow {
  salesId:                    string;
  salesName:                  string;
  period:                     string;
  leadsCount:                 number;
  openLeadsCount:             number;
  visitsCount:                number;
  upcomingVisitsCount:        number;
  reservationsCount:          number;
  activeReservationsCount:    number;
  convertedReservationsCount: number;
  signedContractsCount:       number;
  realizedValue:              number;
  targetAmount:               number | null;
  targetUnits:                number | null;
  achievedAmount:             number;
  achievedUnits:              number;
  targetAmountPercent:        number | null;
  targetUnitsPercent:         number | null;
}

interface ManagerAlert {
  label: string;
  desc:  string;
  count?: number;
  href?:  string;
  tone:  'warning' | 'danger' | 'info';
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function pctDisplay(value: number | null, m: ReturnType<typeof uiT>['pages']['salesManagerHome']): string {
  if (value === null) return '—';
  if (value > 200)   return m.pctExceeded;
  return `${value}%`;
}

function pctSub(value: number | null, m: ReturnType<typeof uiT>['pages']['salesManagerHome']): string | undefined {
  if (value === null || value < 100) return undefined;
  return value > 200 ? m.pctAboveTarget : m.pctTargetMet;
}

function formatPeriod(period: string, months: readonly string[]): string {
  const [year, monthStr] = period.split('-');
  const mo = parseInt(monthStr ?? '1', 10);
  return `${months[mo - 1] ?? ''} ${year ?? ''}`.trim();
}

function daysUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 86400000;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr), now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-brand-100   text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100  text-violet-700',
  'bg-sky-100     text-sky-700',
  'bg-amber-100   text-amber-700',
  'bg-pink-100    text-pink-700',
  'bg-teal-100    text-teal-700',
];

function avatarCls(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ── Design helpers ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{children}</span>
      <span className="flex-1 h-px bg-hairline" />
    </div>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
// ── Main component ────────────────────────────────────────────────────────────
export async function SalesManagerDashboard() {
  const locale = await getLocale();
  const m = uiT(locale).pages.salesManagerHome;

  const nowIso = new Date().toISOString();
  // The company's month (its time zone), not UTC's.
  const period = todayIn(await getCompanyTimeZone()).slice(0, 7);
  const currency = await getReportsCurrency();
  const symbol = currencySymbol(currency, locale);

  const in7DaysIso = new Date(Date.now() + 7 * 86400000).toISOString();

  // FG-23 — every count below comes from meta.total or meta.facets. These
  // used to be ?pageSize=100 snapshots counted client-side, so a team past a
  // hundred leads or reservations saw wrong KPIs, funnel and pipeline.
  const [perfRes, leadsRes, reservationsRes, activeRes, expiringRes, visitsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    // Newest five (the API orders by createdAt desc) + stage facets.
    safe(api.get<Paged<Lead>>('/leads?pageSize=5')),
    // Status facets only.
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
    // The five active reservations that lapse soonest.
    safe(api.get<Paged<Reservation>>('/reservations?status=PENDING,APPROVED&sort=expiresAt&pageSize=5')),
    safe(api.get<Paged<Reservation>>(
      `/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${in7DaysIso}&pageSize=1`,
    )),
    safe(api.get<Paged<VisitAppointment>>(
      `/visits/appointments?scheduledFrom=${nowIso}&open=true&pageSize=50`,
    )),
  ]);

  const perf         = perfRes.data        ?? [];
  const leadStages   = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resvStatus   = reservationsRes.data?.meta.facets?.counts?.status ?? {};
  const visits       = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const periodLabel = formatPeriod(period, m.monthsAr);

  // ── Team KPI rollups ──────────────────────────────────────────────────────
  const sum = (pick: (r: PerformanceRow) => number) =>
    perf.reduce((acc, r) => acc + pick(r), 0);

  const teamLeads              = sum((r) => r.leadsCount);
  const teamOpenLeads          = sum((r) => r.openLeadsCount);
  const teamUpcomingVisits     = sum((r) => r.upcomingVisitsCount);
  const teamActiveReservations = sum((r) => r.activeReservationsCount);
  const teamSigned             = sum((r) => r.signedContractsCount);
  const teamRealized           = sum((r) => r.realizedValue);
  const teamTargetAmount       = sum((r) => r.targetAmount ?? 0);
  // Against the targets set: only the sales of reps who have one (a rep with
  // no target pushed the team past 100%).
  const teamRealizedOnTarget   = sum((r) => (r.targetAmount ? r.realizedValue : 0));
  const teamAmountPct          =
    teamTargetAmount > 0 ? Math.round((teamRealizedOnTarget / teamTargetAmount) * 100) : null;
  // For funnel
  const teamVisits             = sum((r) => r.visitsCount);
  const teamReservations       = sum((r) => r.reservationsCount);

  // ── Pipeline distribution ─────────────────────────────────────────────────
  const allLeadsCount          = leadsRes.data?.meta.total ?? 0;
  const openLeadsCount         = allLeadsCount - (leadStages.WON ?? 0) - (leadStages.LOST ?? 0);
  const pipelineTotal          = openLeadsCount;
  const upcomingVisitsCount    = visitsRes.data?.meta.total ?? 0;
  // Funnel: use direct-fetch counts (not monthly perf which can be 0 mid-month)
  const funnelReservations     = (resvStatus.PENDING ?? 0) + (resvStatus.APPROVED ?? 0);
  const pipelineStageCount: Record<string, number> = Object.fromEntries(
    Object.entries(leadStages).filter(([stage]) => stage !== 'WON' && stage !== 'LOST'),
  );

  // ── Top performer ─────────────────────────────────────────────────────────
  const repRows = perf.slice().sort((a, b) => b.realizedValue - a.realizedValue);
  const topPerformer = repRows.find((r) => r.achievedAmount > 0 || r.signedContractsCount > 0) ?? null;

  // ── Manager alerts ────────────────────────────────────────────────────────
  const inactiveReps = repRows.filter(
    (r) => r.leadsCount === 0 && r.visitsCount === 0 && r.reservationsCount === 0,
  );
  const teamExpiringCount = expiringRes.data?.meta.total ?? 0;
  const teamPendingCount  = resvStatus.PENDING ?? 0;

  const managerAlerts: ManagerAlert[] = [];
  if (teamExpiringCount > 0) {
    managerAlerts.push({
      label: m.alertExpiringLabel,
      count: teamExpiringCount,
      desc:  m.alertExpiringDesc(teamExpiringCount),
      href:  '/dashboard/reservations',
      tone: 'warning',
    });
  }
  if (teamPendingCount > 0) {
    managerAlerts.push({
      label: m.alertPendingLabel,
      count: teamPendingCount,
      desc:  m.alertPendingDesc(teamPendingCount),
      href:  '/dashboard/reservations',
      tone: 'info',
    });
  }
  if (inactiveReps.length > 0) {
    managerAlerts.push({
      label: m.alertInactiveRepsLabel,
      desc:
        inactiveReps.slice(0, 3).map((r) => r.salesName).join(m.listSeparator) +
        (inactiveReps.length > 3 ? m.alertInactiveRepsMore(inactiveReps.length - 3) : ''),
      tone: 'warning',
    });
  }

  // Expiry label helper (locale-aware)
  function expiryLabel(rem: number): string {
    if (rem <= 0) return m.expiryToday;
    if (rem === 1) return m.expiryTomorrow;
    return m.expiryDays(rem);
  }

  // ── Section rows ──────────────────────────────────────────────────────────
  const recentLeads = leadsRes.data?.data ?? [];

  const activeReservationRows = activeRes.data?.data ?? [];

  const upcomingVisitRows = visits.slice(0, 5);

  const showVisits       = !visitsRes.error       && upcomingVisitRows.length     > 0;
  const showReservations = !activeRes.error        && activeReservationRows.length > 0;
  const showLeads        = !leadsRes.error         && recentLeads.length           > 0;
  const bottomCount      = [showVisits, showReservations, showLeads].filter(Boolean).length;

  return (
    <div className="space-y-5">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.heroTitle}
        description={m.heroDesc}
        breadcrumbs={[{ label: m.heroBreadcrumb, href: '/dashboard' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/leads/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.btnAddLead}
              </Button>
            </Link>
            <Link href="/dashboard/visits/new">
              <Button variant="outline" size="md" leftIcon={<CalendarPlus className="h-4 w-4" />}>
                {m.btnScheduleVisit}
              </Button>
            </Link>
            <Link href="/dashboard/reservations/new">
              <Button variant="outline" size="md" leftIcon={<BookmarkCheck className="h-4 w-4" />}>
                {m.btnCreateReservation}
              </Button>
            </Link>
            <Link href="/dashboard/my-compensation">
              <Button variant="outline" size="md" leftIcon={<Wallet className="h-4 w-4" />}>
                {m.btnMyCompensation}
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── KPI band (U5): one navy band; status as a coloured line, not coloured cards ── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          { label: m.kpiTeamLeads, value: leadsRes.error ? '—' : allLeadsCount, icon: <Users />, sub: m.kpiTeamLeadsSub(openLeadsCount) },
          { label: m.kpiOpenLeads, value: leadsRes.error ? '—' : openLeadsCount, icon: <Zap />, sub: m.kpiOpenLeadsSub(allLeadsCount) },
          { label: m.kpiUpcomingVisits, value: visitsRes.error ? '—' : upcomingVisitsCount, icon: <CalendarClock />, sub: m.kpiUpcomingVisitsSub },
          {
            label: m.kpiActiveReservations, value: reservationsRes.error ? '—' : funnelReservations, icon: <BookmarkCheck />,
            trend: teamExpiringCount > 0 ? m.kpiActiveReservationsSubWarning(teamExpiringCount) : m.kpiActiveReservationsSubOk,
            trendCls: teamExpiringCount > 0 ? 'warning' : 'success',
          },
          { label: m.kpiMonthContracts, value: perfRes.error ? '—' : teamSigned, icon: <FileText />, sub: periodLabel },
          perfRes.error
            ? { label: m.kpiRealizedValue, value: '—', icon: <Banknote /> }
            : {
                label: m.kpiRealizedValue, value: compactParts(teamRealized, symbol, locale)[0],
                unit: compactParts(teamRealized, symbol, locale)[1], icon: <Banknote />, sub: m.kpiRealizedValueSub(periodLabel),
              },
          {
            label: m.kpiFinancialTarget, value: perfRes.error ? '—' : pctDisplay(teamAmountPct, m), icon: <Target />,
            ring: !perfRes.error && teamAmountPct !== null ? teamAmountPct : undefined,
            trend: perfRes.error ? undefined : pctSub(teamAmountPct, m),
            trendCls: teamAmountPct === null ? undefined : teamAmountPct >= 80 ? 'success' : teamAmountPct >= 50 ? 'warning' : 'danger',
          },
          {
            label: m.kpiTeamAlerts, value: managerAlerts.length, icon: <Bell />,
            trend: managerAlerts.length > 0 ? m.kpiTeamAlertsSubWarning : m.kpiTeamAlertsSubOk,
            trendCls: managerAlerts.length > 0 ? 'warning' : 'success',
          },
        ]}
      />

      {/* ── Team Performance Table ────────────────────────────────────────── */}
      <TeamPerformanceTable
        perfError={perfRes.error}
        repRows={repRows}
        period={period}
        periodLabel={periodLabel}
        symbol={symbol}
        topPerformerId={topPerformer?.salesId ?? null}
        m={m}
        locale={locale}
      />

      {/* ── Team Conversion Funnel ────────────────────────────────────────── */}
      {!leadsRes.error && (
        <TeamFunnel
          topPerformer={topPerformer}
          symbol={symbol}
          m={m}
          locale={locale}
        />
      )}

      {/* ── Pipeline + Alerts ─────────────────────────────────────────────── */}
      {(!leadsRes.error || managerAlerts.length > 0) && (
        <div className={cn('grid grid-cols-1 gap-5 items-stretch', managerAlerts.length > 0 ? 'lg:grid-cols-3' : '')}>
          {!leadsRes.error && (
            <StagePipeline
              className={managerAlerts.length > 0 ? 'lg:col-span-2' : ''}
              title={m.pipelineTitle}
              sub={pipelineTotal > 0
                ? m.pipelineTotal(pipelineTotal, Object.values(pipelineStageCount).filter((n) => n > 0).length)
                : m.pipelineEmpty}
              labels={{
                NEW: m.stageLabelNew,
                INTERESTED: m.stageLabelInterested,
                VISIT: m.stageLabelVisit,
                NEGOTIATION: m.stageLabelNegotiation,
              }}
              counts={pipelineStageCount}
              link={{ href: '/dashboard/leads', label: m.pipelineOpenLink }}
              emptyNote={m.pipelineEmptyNote}
            />
          )}
          {managerAlerts.length > 0 && (
            <AlertCard alerts={managerAlerts} m={m} />
          )}
        </div>
      )}

      {/* ── Activity section ──────────────────────────────────────────────── */}
      {bottomCount > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>{m.sectionLastActivity}</SectionLabel>
          {showLeads && (showVisits || showReservations) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
              <SectionCard
                title={m.cardRecentLeads}
                icon={<Zap />}
                iconCls="bg-brand-50 text-brand-600 ring-brand-100"
                href="/dashboard/leads"
                hrefLabel={m.cardOpenLeadsLink}
                error={leadsRes.error}
                empty={recentLeads.length === 0}
                emptyText={m.emptyRecentLeads}
                loadErrorText={m.cardLoadError}
                className="lg:col-span-2"
              >
                {recentLeads.map((l) => (
                  <Link key={l.id} href={`/dashboard/leads/${l.id}` as never}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                        {l.client?.fullName ?? l.fullName}
                      </p>
                      <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
                        {l.assignedSales?.fullName ?? '—'}
                        {' · '}
                        {l.projectInterest ? tx(l.projectInterest.name) : m.noProject}
                      </p>
                    </div>
                    <LeadStageBadge stage={l.stage} />
                  </Link>
                ))}
              </SectionCard>

              <div className="space-y-4">
                {showVisits && (
                  <SectionCard
                    title={m.cardTeamVisits}
                    icon={<CalendarClock />}
                    iconCls="bg-sky-50 text-sky-600 ring-sky-100"
                    href="/dashboard/visits"
                    hrefLabel={m.cardVisitsLink}
                    error={visitsRes.error}
                    empty={upcomingVisitRows.length === 0}
                    emptyText={m.emptyUpcomingVisits}
                    loadErrorText={m.cardLoadError}
                  >
                    {upcomingVisitRows.map((v) => (
                      <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                              {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                            </p>
                            {isToday(v.scheduledAt) && (
                              <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
                                {m.badgeToday}
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-slate-400 mt-0.5 leading-tight">
                            <span className="tabular-nums">{formatDateTime(v.scheduledAt, locale)}</span>
                            {v.assignedSales ? ` · ${v.assignedSales.fullName}` : ''}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={v.status} />
                      </Link>
                    ))}
                  </SectionCard>
                )}
                {showReservations && (
                  <SectionCard
                    title={m.cardFollowReservations}
                    icon={<BookmarkCheck />}
                    iconCls="bg-emerald-50 text-emerald-600 ring-emerald-100"
                    href="/dashboard/reservations"
                    hrefLabel={m.cardReservationsLink}
                    error={activeRes.error}
                    empty={activeReservationRows.length === 0}
                    emptyText={m.emptyActiveReservations}
                    loadErrorText={m.cardLoadError}
                  >
                    {activeReservationRows.map((r) => {
                      const rem = Math.ceil(daysUntil(r.expiresAt));
                      const isUrgent  = rem <= 1;
                      const isWarning = rem > 1 && rem <= 7;
                      return (
                        <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                              {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                              {r.unit?.code ? ` · ${r.unit.code}` : ''}
                            </p>
                            <p className="text-2xs mt-0.5 leading-tight">
                              <span className="text-slate-400">{r.sales?.fullName ?? '—'}</span>
                              {r.expiresAt && (
                                <>
                                  {' · '}
                                  <span className={cn(
                                    'tabular-nums font-medium',
                                    isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                  )}>
                                    {expiryLabel(rem)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <ReservationStatusBadge status={r.status} />
                        </Link>
                      );
                    })}
                  </SectionCard>
                )}
              </div>
            </div>
          ) : showLeads ? (
            <SectionCard
              title={m.cardRecentLeads}
              icon={<Zap />}
              iconCls="bg-brand-50 text-brand-600 ring-brand-100"
              href="/dashboard/leads"
              hrefLabel={m.cardOpenLeadsLink}
              error={leadsRes.error}
              empty={recentLeads.length === 0}
              emptyText={m.emptyRecentLeads}
              loadErrorText={m.cardLoadError}
              className="max-w-2xl"
            >
              {recentLeads.map((l) => (
                <Link key={l.id} href={`/dashboard/leads/${l.id}` as never}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                      {l.client?.fullName ?? l.fullName}
                    </p>
                    <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
                      {l.assignedSales?.fullName ?? '—'}
                      {' · '}
                      {l.projectInterest ? tx(l.projectInterest.name) : m.noProject}
                    </p>
                  </div>
                  <LeadStageBadge stage={l.stage} />
                </Link>
              ))}
            </SectionCard>
          ) : (
            <div className={cn('grid grid-cols-1 gap-4 lg:items-start', showVisits && showReservations ? 'lg:grid-cols-2' : '')}>
              {showVisits && (
                <SectionCard
                  title={m.cardTeamVisits}
                  icon={<CalendarClock />}
                  iconCls="bg-sky-50 text-sky-600 ring-sky-100"
                  href="/dashboard/visits"
                  hrefLabel={m.cardVisitsLink}
                  error={visitsRes.error}
                  empty={upcomingVisitRows.length === 0}
                  emptyText={m.emptyUpcomingVisits}
                  loadErrorText={m.cardLoadError}
                >
                  {upcomingVisitRows.map((v) => (
                    <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                        </p>
                        <p className="text-2xs text-slate-400 mt-0.5">
                          <span className="tabular-nums">{formatDateTime(v.scheduledAt, locale)}</span>
                          {v.assignedSales ? ` · ${v.assignedSales.fullName}` : ''}
                        </p>
                      </div>
                      <AppointmentStatusBadge status={v.status} />
                    </Link>
                  ))}
                </SectionCard>
              )}
              {showReservations && (
                <SectionCard
                  title={m.cardFollowReservations}
                  icon={<BookmarkCheck />}
                  iconCls="bg-emerald-50 text-emerald-600 ring-emerald-100"
                  href="/dashboard/reservations"
                  hrefLabel={m.cardReservationsLink}
                  error={activeRes.error}
                  empty={activeReservationRows.length === 0}
                  emptyText={m.emptyActiveReservations}
                  loadErrorText={m.cardLoadError}
                >
                  {activeReservationRows.map((r) => {
                    const rem = Math.ceil(daysUntil(r.expiresAt));
                    const isUrgent  = rem <= 1;
                    const isWarning = rem > 1 && rem <= 7;
                    return (
                      <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                            {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                            {r.unit?.code ? ` · ${r.unit.code}` : ''}
                          </p>
                          <p className="text-2xs mt-0.5 leading-tight">
                            <span className="text-slate-400">{r.sales?.fullName ?? '—'}</span>
                            {r.expiresAt && (
                              <>
                                {' · '}
                                <span className={cn(
                                  'tabular-nums font-medium',
                                  isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
                                )}>
                                  {expiryLabel(rem)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <ReservationStatusBadge status={r.status} />
                      </Link>
                    );
                  })}
                </SectionCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Conversion Funnel ────────────────────────────────────────────────────
function TeamFunnel({
  topPerformer, symbol, m, locale = 'ar',
}: {
  topPerformer:     PerformanceRow | null;
  symbol:           string;
  m: ReturnType<typeof uiT>['pages']['salesManagerHome'];
  locale?:          Locale;
}) {
  // The stage counts are the KPIs above; this card keeps only the month's top performer.
  if (!topPerformer) return null;
  return (
    <section
      data-testid="top-performer"
      className="relative overflow-hidden rounded-[22px] border border-brand-500/30 bg-surface"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-brand-500/[0.10] via-transparent to-transparent" />
      <div className="relative flex flex-wrap items-center gap-5 px-6 py-5">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 text-brand-700 ring-2 ring-brand-500/40">
          <Star className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-brand-700">{m.topPerformerLabel}</p>
          <p className="mt-0.5 truncate font-heading text-[22px] font-bold text-slate-900">{topPerformer.salesName}</p>
        </div>
        <dl className="flex items-center gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          <div className="bg-surface px-5 py-2.5 text-center">
            <dt className="text-[11px] text-slate-500">{m.topPerformerContracts}</dt>
            <dd className="mt-0.5 text-[20px] font-bold tabular-nums text-emerald-600">{topPerformer.signedContractsCount}</dd>
          </div>
          {topPerformer.achievedAmount > 0 && (
            <div className="bg-surface px-5 py-2.5 text-center">
              <dt className="text-[11px] text-slate-500">{m.topPerformerAchieved}</dt>
              <dd className="mt-0.5 text-[20px] font-bold tabular-nums text-brand-700">{formatCompact(topPerformer.achievedAmount, symbol, locale)}</dd>
            </div>
          )}
          {topPerformer.targetAmountPercent !== null && (
            <div className="bg-surface px-5 py-2.5 text-center">
              <dt className="text-[11px] text-slate-500">{m.topPerformerCompletion}</dt>
              <dd className={cn(
                'mt-0.5 text-[20px] font-bold tabular-nums',
                topPerformer.targetAmountPercent >= 80 ? 'text-emerald-600'
                : topPerformer.targetAmountPercent >= 50 ? 'text-amber-600'
                : 'text-slate-600',
              )}>
                {Math.round(topPerformer.targetAmountPercent)}%
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

// ── Team Performance Table ────────────────────────────────────────────────────
function TeamPerformanceTable({
  perfError, repRows, period, periodLabel, symbol, topPerformerId, m, locale = 'ar',
}: {
  perfError?:       string | null;
  repRows:          PerformanceRow[];
  period:           string;
  periodLabel:      string;
  symbol?:          string;
  topPerformerId:   string | null;
  m: ReturnType<typeof uiT>['pages']['salesManagerHome'];
  locale?:          Locale;
}) {
  return (
    <div className="bg-surface border border-hairline rounded-[22px] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-full border border-brand-400/50 flex items-center justify-center shrink-0 text-brand-700 [&>svg]:h-4 [&>svg]:w-4">
            <Users />
          </span>
          <div>
            <h3 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{m.teamPerfTableTitle}</h3>
            {repRows.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">{m.teamPerfRepsCount(repRows.length)} · {periodLabel}</p>
            )}
          </div>
        </div>
        <Link href="/dashboard/targets"
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors">
          {m.teamPerfManageTargets}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {perfError ? (
        <div className="flex items-start gap-2 text-amber-700 text-sm px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{m.teamPerfLoadError}</p>
        </div>
      ) : repRows.length === 0 ? (
        <EmptyState icon={<Users />} title={m.teamPerfEmpty} className="py-8" />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[660px]">
            <thead className="bg-canvas/50 border-b border-hairline">
              <tr>
                <th className="px-5 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">{m.teamPerfColRep}</th>
                <th className="px-3 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">{m.teamPerfColStatus}</th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-400 inline-block" />{m.teamPerfColLeads}</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400 inline-block" />{m.teamPerfColVisits}</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />{m.teamPerfColReservations}</span>
                </th>
                <th className="px-3 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />{m.teamPerfColContracts}</span>
                </th>
                <th className="px-4 py-3 text-end text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">{m.teamPerfColAchieved}</th>
                <th className="px-4 py-3 text-start text-[11px] font-bold text-slate-500 tracking-tight whitespace-nowrap">{m.teamPerfColCompletion}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {repRows.map((r) => {
                const isActive = r.leadsCount > 0 || r.visitsCount > 0 || r.reservationsCount > 0;
                const isTop    = r.salesId === topPerformerId;
                return (
                  <tr key={r.salesId}
                    className={cn('hover:bg-canvas/40 transition-colors', !isActive && 'opacity-60')}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                          avatarCls(r.salesName),
                        )}>
                          {initials(r.salesName)}
                        </span>
                        <span className="font-semibold text-slate-800 text-sm">{r.salesName}</span>
                        {isTop && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                            <Star className="h-2.5 w-2.5 fill-amber-500 stroke-none" />
                            {m.teamPerfStarBadge}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {m.teamPerfStatusActive}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold bg-slate-100 text-slate-500">
                          {m.teamPerfStatusInactive}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.leadsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.visitsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-slate-600 text-end font-medium">{r.reservationsCount}</td>
                    <td className="px-3 py-3 tabular-nums text-emerald-700 text-end font-bold">{r.signedContractsCount}</td>
                    <td className="px-4 py-3 tabular-nums font-bold text-slate-900 whitespace-nowrap text-end text-[13px]">
                      {r.achievedAmount > 0 ? (
                        formatCompact(r.achievedAmount, symbol, locale)
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.targetAmountPercent !== null ? (
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <span className={cn(
                            'text-[18px] font-black tabular-nums leading-none',
                            r.targetAmountPercent >= 80  ? 'text-emerald-700'
                            : r.targetAmountPercent >= 50 ? 'text-amber-600'
                            : 'text-slate-500',
                          )}>
                            {Math.round(r.targetAmountPercent)}%
                          </span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                r.targetAmountPercent >= 80  ? 'bg-emerald-500'
                                : r.targetAmountPercent >= 50 ? 'bg-amber-400'
                                : 'bg-slate-300',
                              )}
                              style={{ width: `${Math.min(r.targetAmountPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-300 font-medium">{m.teamPerfNoTarget}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────
// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({
  alerts, m,
}: {
  alerts: ManagerAlert[];
  m: ReturnType<typeof uiT>['pages']['salesManagerHome'];
}) {
  const TONE_CONFIG: Record<ManagerAlert['tone'], {
    icon: React.ReactNode; ringCls: string; iconCls: string; countCls: string; titleCls: string;
  }> = {
    warning: {
      icon:     <AlertTriangle className="h-4 w-4" />,
      ringCls:  'bg-amber-500/12 text-amber-600',
      iconCls:  '',
      countCls: 'bg-amber-500/15 text-amber-600',
      titleCls: 'text-slate-900',
    },
    danger: {
      icon:     <AlertCircle className="h-4 w-4" />,
      ringCls:  'bg-danger-500/12 text-danger-600',
      iconCls:  '',
      countCls: 'bg-danger-500/15 text-danger-600',
      titleCls: 'text-slate-900',
    },
    info: {
      icon:     <Info className="h-4 w-4" />,
      ringCls:  'bg-brand-500/12 text-brand-700',
      iconCls:  '',
      countCls: 'bg-brand-500/15 text-brand-700',
      titleCls: 'text-slate-900',
    },
  };

  return (
    <div data-testid="team-alerts" className="h-full bg-surface border border-amber-500/30 rounded-[22px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-amber-500/20 bg-amber-500/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full bg-amber-500/12 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{m.alertCardTitle}</h3>
            <p className="text-[12px] text-amber-600 mt-0.5">{m.alertCardItemsNeedReview(alerts.length)}</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center h-7 min-w-7 rounded-full bg-amber-500/15 text-amber-600 text-[13px] font-bold px-2 tabular-nums">
          {alerts.length}
        </span>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-hairline">
        {alerts.map((alert, i) => {
          const cfg = TONE_CONFIG[alert.tone];
          return (
            <div key={i} className="flex items-start gap-3.5 px-5 py-4">
              {/* Icon ring */}
              <span className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                cfg.ringCls,
              )}>
                {cfg.icon}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={cn('text-sm font-bold leading-tight', cfg.titleCls)}>{alert.label}</p>
                  {alert.count !== undefined && (
                    <span className={cn('inline-flex items-center justify-center h-5 min-w-5 rounded-full text-2xs font-black px-1.5 tabular-nums', cfg.countCls)}>
                      {alert.count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-snug">{alert.desc}</p>
                {alert.href && (
                  <Link href={alert.href as never}
                    className="inline-flex items-center gap-0.5 text-2xs font-bold text-brand-700 hover:text-brand-800 transition-colors mt-1.5">
                    {m.alertViewDetails}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({
  title, icon, iconCls, href, hrefLabel = '',
  error, empty, emptyText, loadErrorText, className, children,
}: {
  title: string; icon: React.ReactNode; iconCls: string;
  href: string; hrefLabel?: string;
  error?: string | null; empty: boolean; emptyText: string;
  loadErrorText: string;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn('bg-surface border border-hairline rounded-[22px] overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-3">
          <span className={cn(
            'h-10 w-10 rounded-full border border-brand-400/50 flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4',
            iconCls,
          )}>
            {icon}
          </span>
          <h3 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{title}</h3>
        </div>
        <Link href={href as never}
          className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors shrink-0">
          {hrefLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {error ? (
        <div className="flex items-start gap-2 text-amber-700 text-xs px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{loadErrorText}</p>
        </div>
      ) : empty ? (
        <div className="flex items-center gap-2.5 px-5 py-5">
          <AlertCircle className="h-4 w-4 text-slate-300 shrink-0" />
          <p className="text-xs text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </div>
  );
}
