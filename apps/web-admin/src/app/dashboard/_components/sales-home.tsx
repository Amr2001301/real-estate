import Link from 'next/link';
import { getCompanyTimeZone, todayIn } from '@/lib/currency';
import {
  Zap,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Home,
  Plus,
  CalendarPlus,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ArrowUpRight,
  Target,
  Users,
  ArrowRight,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { StagePipeline } from '@/components/crm/stage-pipeline';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

interface PerformanceRow {
  signedContractsCount: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 86400000;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr), now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate()  === now.getDate();
}

// A NEW or INTERESTED lead this many days old counts as stale on the KPI
// tile. The server applies it via ?createdBefore, so the tile and the row
// badges below share one threshold.
const STALE_AFTER_DAYS = 3;

function leadAgeDays(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000);
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

// ── Main component ────────────────────────────────────────────────────────────
export async function SalesDashboard({ userId }: { userId: string }) {
  const locale = await getLocale();
  const m = uiT(locale).pages.salesHome;

  const now       = new Date();
  const nowIso    = now.toISOString();
  const staleIso  = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  const in7DaysIso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // FG-23 — every count below comes from the server (meta.total or
  // meta.facets), never from counting a capped page of rows. These calls used
  // to be ?pageSize=100 snapshots, so a rep past a hundred leads or
  // reservations saw wrong KPIs with nothing on screen to say so.
  const [leadsRes, staleRes, reservationsRes, activeRes, expiringRes, visitsRes, unitsRes, perfRes] =
    await Promise.all([
      // Newest five (the API orders by createdAt desc) + stage facets.
      safe(api.get<Paged<Lead>>('/leads?pageSize=5')),
      safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
      // Status facets only.
      safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
      // The five active reservations that lapse soonest.
      safe(api.get<Paged<Reservation>>('/reservations?status=PENDING,APPROVED&sort=expiresAt&pageSize=5')),
      // Active and lapsing within 7 days, soonest first. The urgent (<48h)
      // rows are the head of this list; 50 is far above what one rep can
      // have lapse in two days, and the 7-day count is meta.total regardless.
      safe(api.get<Paged<Reservation>>(
        `/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${in7DaysIso}&sort=expiresAt&pageSize=50`,
      )),
      safe(api.get<Paged<VisitAppointment>>(
        `/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${nowIso}&open=true&pageSize=50`,
      )),
      safe(api.get<Paged<unknown>>('/units?status=AVAILABLE&pageSize=1')),
      // The company's month (its time zone), not UTC's.
      safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${todayIn(await getCompanyTimeZone()).slice(0, 7)}`)),
    ]);

  const leadStages  = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resvStatus  = reservationsRes.data?.meta.facets?.counts?.status ?? {};
  const visits      = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ── KPI computations ──────────────────────────────────────────────────────
  const wonLeads             = leadStages.WON ?? 0;
  const lostLeads            = leadStages.LOST ?? 0;
  const openLeadsCount       = (leadsRes.data?.meta.total ?? 0) - wonLeads - lostLeads;
  const activeReservationsCount = (resvStatus.PENDING ?? 0) + (resvStatus.APPROVED ?? 0);
  const signedThisMonth      = (perfRes.data ?? [])[0]?.signedContractsCount;
  const convertedDeals       = resvStatus.CONVERTED ?? 0;
  const closedDeals          = signedThisMonth ?? convertedDeals;
  const availableUnits       = unitsRes.data?.meta.total ?? 0;
  const upcomingVisitsCount  = visitsRes.data?.meta.total ?? 0;

  // Stale = NEW or INTERESTED and created STALE_AFTER_DAYS or more ago.
  const staleLeadsCount      = staleRes.data?.meta.total ?? 0;
  const expiringWithin7      = expiringRes.data?.meta.total ?? 0;
  const todayVisits = visits.filter((v) => isToday(v.scheduledAt));
  const expiringUrgent = (expiringRes.data?.data ?? []).filter((r) => daysUntil(r.expiresAt) < 2);

  // Stage distribution — open stages only, as before.
  const stageGroups: Record<string, number> = Object.fromEntries(
    Object.entries(leadStages).filter(([stage]) => stage !== 'WON' && stage !== 'LOST'),
  );

  // Content rows
  const recentLeads           = leadsRes.data?.data ?? [];
  const upcomingVisitRows     = visits.slice(0, 5);
  const activeReservationRows = activeRes.data?.data ?? [];

  const showVisits       = !visitsRes.error && upcomingVisitRows.length > 0;
  const showReservations = !activeRes.error && activeReservationRows.length > 0;
  const hasPriorities    = todayVisits.length > 0 || expiringUrgent.length > 0;

  // Expiry label helper (locale-aware)
  function expiryLabel(dateStr: string): string {
    const d = Math.ceil(daysUntil(dateStr));
    if (d <= 0) return m.expiryToday;
    if (d === 1) return m.expiryTomorrow;
    return m.expiryDays(d);
  }

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
          </div>
        }
      />

      {/* ── KPI band (U5): one navy band; warnings as a coloured line, not coloured cards ── */}
      <PremiumMetricStrip
        variant="compact"
        cols={3}
        metrics={[
          { label: m.kpiOpenLeads, value: openLeadsCount, icon: <Zap />, sub: m.kpiOpenLeadsSub(wonLeads, lostLeads) },
          {
            label: m.kpiStaleLeads, value: staleLeadsCount, icon: <AlertTriangle />,
            trend: staleLeadsCount > 0 ? m.kpiStaleLeadsSubWarning : m.kpiStaleLeadsSubOk,
            trendCls: staleLeadsCount > 0 ? 'warning' : 'success',
          },
          {
            label: m.kpiUpcomingVisits, value: upcomingVisitsCount, icon: <CalendarClock />,
            sub: todayVisits.length > 0 ? m.kpiUpcomingVisitsSubToday(todayVisits.length) : m.kpiUpcomingVisitsSubNone,
          },
          {
            label: m.kpiActiveReservations, value: activeReservationsCount, icon: <BookmarkCheck />,
            trend: expiringWithin7 > 0 ? m.kpiActiveReservationsSubWarning(expiringWithin7) : m.kpiActiveReservationsSubOk,
            trendCls: expiringWithin7 > 0 ? 'warning' : 'success',
          },
          {
            label: m.kpiMonthContracts, value: closedDeals, icon: <FileText />,
            sub: signedThisMonth !== undefined ? m.kpiMonthContractsSigned : m.kpiMonthContractsConverted,
          },
          { label: m.kpiAvailableUnits, value: availableUnits, icon: <Home />, sub: m.kpiAvailableUnitsSub },
        ]}
      />

      {/* ── Sales pipeline ────────────────────────────────────────────────── */}
      {/* Where my open leads sit (the counts above are not repeated here) */}
      <StagePipeline
        title={m.pipelineTitle}
        sub={uiT(locale).pages.salesManagerHome.pipelineTotal(
          openLeadsCount,
          ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION'].filter((k) => (stageGroups[k] ?? 0) > 0).length,
        )}
        labels={{
          NEW: m.stageLabelNew,
          INTERESTED: m.stageLabelInterested,
          VISIT: m.stageLabelVisit,
          NEGOTIATION: m.stageLabelNegotiation,
        }}
        counts={stageGroups}
        link={{ href: '/dashboard/leads', label: uiT(locale).pages.salesManagerHome.pipelineOpenLink }}
        emptyNote={uiT(locale).pages.salesManagerHome.pipelineEmptyNote}
      />

      {/* ── Today priorities ──────────────────────────────────────────────── */}
      {hasPriorities && (
        <div className="space-y-2.5">
          <SectionLabel>{m.sectionTodayPriorities}</SectionLabel>
          <TodayPriorityPanel todayVisits={todayVisits} expiringUrgent={expiringUrgent} m={m} expiryLabel={expiryLabel} locale={locale} />
        </div>
      )}

      {/* ── Current activity ──────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <SectionLabel>{m.sectionCurrentActivity}</SectionLabel>
        {showVisits && showReservations ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">
            <SectionCard
              title={m.cardRecentLeads}
              icon={<Zap />}
              iconCls="bg-brand-50 ring-brand-100 text-brand-600"
              href="/dashboard/leads"
              hrefLabel={m.cardOpenLeadsLink}
              error={leadsRes.error}
              empty={recentLeads.length === 0}
              emptyText={m.emptyRecentLeads}
              loadErrorText={m.cardLoadError}
              className="lg:col-span-2"
            >
              {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} locale={locale} />)}
            </SectionCard>
            <div className="space-y-4">
              <SectionCard
                title={m.cardUpcomingVisits}
                icon={<CalendarClock />}
                iconCls="bg-sky-50 ring-sky-100 text-sky-600"
                href="/dashboard/visits"
                hrefLabel={m.cardVisitsLink}
                error={visitsRes.error}
                empty={upcomingVisitRows.length === 0}
                emptyText={m.emptyUpcomingVisits}
                loadErrorText={m.cardLoadError}
              >
                {upcomingVisitRows.map((v) => <VisitRow key={v.id} visit={v} m={m} locale={locale} />)}
              </SectionCard>
              <SectionCard
                title={m.cardActiveReservations}
                icon={<BookmarkCheck />}
                iconCls="bg-emerald-50 ring-emerald-100 text-emerald-600"
                href="/dashboard/reservations"
                hrefLabel={m.cardReservationsLink}
                error={activeRes.error}
                empty={activeReservationRows.length === 0}
                emptyText={m.emptyActiveReservations}
                loadErrorText={m.cardLoadError}
              >
                {activeReservationRows.map((r) => <ReservationRow key={r.id} reservation={r} expiryLabel={expiryLabel} />)}
              </SectionCard>
            </div>
          </div>
        ) : showVisits || showReservations ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-start">
            <SectionCard
              title={m.cardRecentLeads}
              icon={<Zap />}
              iconCls="bg-brand-50 ring-brand-100 text-brand-600"
              href="/dashboard/leads"
              hrefLabel={m.cardOpenLeadsLink}
              error={leadsRes.error}
              empty={recentLeads.length === 0}
              emptyText={m.emptyRecentLeads}
              loadErrorText={m.cardLoadError}
            >
              {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} locale={locale} />)}
            </SectionCard>
            {showVisits && (
              <SectionCard
                title={m.cardUpcomingVisits}
                icon={<CalendarClock />}
                iconCls="bg-sky-50 ring-sky-100 text-sky-600"
                href="/dashboard/visits"
                hrefLabel={m.cardVisitsLink}
                error={visitsRes.error}
                empty={upcomingVisitRows.length === 0}
                emptyText={m.emptyUpcomingVisits}
                loadErrorText={m.cardLoadError}
              >
                {upcomingVisitRows.map((v) => <VisitRow key={v.id} visit={v} m={m} locale={locale} />)}
              </SectionCard>
            )}
            {showReservations && (
              <SectionCard
                title={m.cardActiveReservations}
                icon={<BookmarkCheck />}
                iconCls="bg-emerald-50 ring-emerald-100 text-emerald-600"
                href="/dashboard/reservations"
                hrefLabel={m.cardReservationsLink}
                error={activeRes.error}
                empty={activeReservationRows.length === 0}
                emptyText={m.emptyActiveReservations}
                loadErrorText={m.cardLoadError}
              >
                {activeReservationRows.map((r) => <ReservationRow key={r.id} reservation={r} expiryLabel={expiryLabel} />)}
              </SectionCard>
            )}
          </div>
        ) : (
          <SectionCard
            title={m.cardRecentLeads}
            icon={<Zap />}
            iconCls="bg-brand-50 ring-brand-100 text-brand-600"
            href="/dashboard/leads"
            hrefLabel={m.cardOpenLeadsLink}
            error={leadsRes.error}
            empty={recentLeads.length === 0}
            emptyText={m.emptyRecentLeads}
            loadErrorText={m.cardLoadError}
            className="max-w-2xl"
          >
            {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} locale={locale} />)}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── Row sub-components ────────────────────────────────────────────────────────
function LeadRow({ lead: l, m, locale = 'ar' }: { lead: Lead; m: ReturnType<typeof uiT>['pages']['salesHome']; locale?: Locale }) {
  const age     = leadAgeDays(l);
  const isStale = !l.upcomingVisit && age >= STALE_AFTER_DAYS;
  return (
    <Link
      href={`/dashboard/leads/${l.id}` as never}
      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {l.client?.fullName ?? l.fullName}
          </p>
          {isStale && (
            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              {m.badgeStale}
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-400 truncate mt-0.5 leading-tight">
          {l.projectInterest ? tx(l.projectInterest.name) : m.noProject}
          {' · '}
          <span className="tabular-nums">{formatDate(l.createdAt, locale)}</span>
        </p>
      </div>
      <LeadStageBadge stage={l.stage} />
    </Link>
  );
}

function VisitRow({ visit: v, m, locale = 'ar' }: { visit: VisitAppointment; m: ReturnType<typeof uiT>['pages']['salesHome']; locale?: Locale }) {
  const today = isToday(v.scheduledAt);
  return (
    <Link
      href={`/dashboard/visits/appointments/${v.id}` as never}
      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
          </p>
          {today && (
            <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
              {m.badgeToday}
            </span>
          )}
        </div>
        <p className="text-2xs text-slate-400 mt-0.5 leading-tight">
          <span className={cn('tabular-nums', today && 'font-semibold text-brand-700')}>
            {formatDateTime(v.scheduledAt, locale)}
          </span>
          {v.project ? ` · ${tx(v.project.name)}` : ''}
        </p>
      </div>
      <AppointmentStatusBadge status={v.status} />
    </Link>
  );
}

function ReservationRow({
  reservation: r,
  expiryLabel,
}: {
  reservation: Reservation;
  expiryLabel: (dateStr: string) => string;
}) {
  const remaining = Math.ceil(daysUntil(r.expiresAt));
  const isUrgent  = remaining <= 1;
  const isWarning = remaining <= 7 && remaining > 1;
  return (
    <Link
      href={`/dashboard/reservations/${r.id}` as never}
      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
          {r.unit?.code ? ` · ${r.unit.code}` : ''}
        </p>
        <p className="text-2xs text-slate-400 mt-0.5 leading-tight truncate">
          {r.lead?.fullName ?? r.client?.fullName ?? '—'}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className={cn(
          'text-2xs font-semibold tabular-nums',
          isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-400',
        )}>
          {expiryLabel(r.expiresAt)}
        </p>
        <ReservationStatusBadge status={r.status} />
      </div>
    </Link>
  );
}

// ── Today priority panel ──────────────────────────────────────────────────────
function TodayPriorityPanel({
  todayVisits, expiringUrgent, m, expiryLabel, locale = 'ar',
}: {
  todayVisits:    VisitAppointment[];
  expiringUrgent: Reservation[];
  m: ReturnType<typeof uiT>['pages']['salesHome'];
  expiryLabel: (dateStr: string) => string;
  locale?: Locale;
}) {
  const total = todayVisits.length + expiringUrgent.length;
  return (
    <div className="bg-surface border border-hairline rounded-[22px] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-hairline bg-amber-50/50">
        <span className="h-8 w-8 rounded-xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center shrink-0 relative">
          <Bell className="h-4 w-4 text-amber-600" />
          <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
        </span>
        <h3 className="text-sm font-bold text-slate-900 flex-1">{m.todayPrioritiesTitle}</h3>
        <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-amber-100 text-amber-800 text-2xs font-black px-1.5 tabular-nums">
          {total}
        </span>
      </div>

      {todayVisits.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-5 py-2 bg-canvas/50 border-t border-hairline">
            <CalendarClock className="h-3.5 w-3.5 text-sky-500" />
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500 flex-1">{m.todayVisitsSubLabel}</span>
            <span className="text-2xs font-black text-sky-500 tabular-nums">{todayVisits.length}</span>
          </div>
          {todayVisits.map((v) => (
            <Link key={v.id} href={`/dashboard/visits/appointments/${v.id}` as never}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60 transition-colors border-t border-hairline">
              <span className="h-8 w-8 rounded-xl bg-sky-50 ring-1 ring-sky-100 flex items-center justify-center shrink-0">
                <CalendarClock className="h-3.5 w-3.5 text-sky-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  <span className="font-bold text-sky-700 tabular-nums">{formatDateTime(v.scheduledAt, locale)}</span>
                  {v.project ? ` · ${tx(v.project.name)}` : ''}
                  {v.unit ? ` · ${m.unitPrefix} ${v.unit.code}` : ''}
                </p>
              </div>
              <AppointmentStatusBadge status={v.status} />
            </Link>
          ))}
        </>
      )}

      {expiringUrgent.length > 0 && (
        <>
          <div className="flex items-center gap-2 px-5 py-2 bg-canvas/50 border-t border-hairline">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-2xs font-bold uppercase tracking-wide text-slate-500 flex-1">{m.expiringReservationsSubLabel}</span>
            <span className="text-2xs font-black text-red-500 tabular-nums">{expiringUrgent.length}</span>
          </div>
          {expiringUrgent.map((r) => (
            <Link key={r.id} href={`/dashboard/reservations/${r.id}` as never}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60 transition-colors border-t border-hairline">
              <span className="h-8 w-8 rounded-xl bg-red-50 ring-1 ring-red-100 flex items-center justify-center shrink-0">
                <BookmarkCheck className="h-3.5 w-3.5 text-red-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                  {r.unit?.code ? ` · ${m.unitPrefix} ${r.unit.code}` : ''}
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">
                  {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                  {' · '}
                  <span className="font-bold text-red-600">{expiryLabel(r.expiresAt)}</span>
                </p>
              </div>
              <ReservationStatusBadge status={r.status} />
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  title, icon, iconCls: _iconCls, href, hrefLabel = '',
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
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-4 border-b border-hairline">
        <div className="flex items-center gap-3">
          {/* U5: a thin gold ring, not a coloured chip (iconCls kept for callers). */}
          <span className="h-10 w-10 rounded-full border border-brand-400/50 text-brand-700 flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
          <h3 className="font-heading text-[18px] font-bold text-slate-900 leading-snug">{title}</h3>
        </div>
        <Link href={href as never} className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors shrink-0">
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
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </div>
  );
}
