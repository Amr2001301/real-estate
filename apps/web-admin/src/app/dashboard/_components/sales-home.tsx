import Link from 'next/link';
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
  TrendingUp,
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
import { PremiumPageHero } from '@/components/premium';
import { getLocale } from '@/lib/locale';
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

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, sub, icon, topBar, iconCls, valueCls,
}: {
  label: string; value: number; sub?: string;
  icon: React.ReactNode; topBar: string; iconCls: string; valueCls: string;
}) {
  return (
    <div className="relative bg-surface rounded-[18px] border border-hairline shadow-soft overflow-hidden">
      <div className={cn('h-[3px] bg-gradient-to-l', topBar)} />
      <div className="flex items-center gap-3 px-4 py-4">
        <span className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4', iconCls)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className={cn('text-xl font-black tabular-nums leading-none', valueCls)}>{value}</p>
          <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Sales Pipeline ────────────────────────────────────────────────────────────
function SalesPipeline({
  openLeads, visitsCount, reservationsCount, contractsCount, stageGroups, m,
}: {
  openLeads: number; visitsCount: number; reservationsCount: number; contractsCount: number;
  stageGroups: Record<string, number>;
  m: ReturnType<typeof uiT>['pages']['salesHome'];
}) {
  const stages = [
    { label: m.stageOpenLeads,         value: openLeads,         icon: <Zap />,           clr: 'brand',   bg: 'bg-brand-50   text-brand-600   ring-brand-100'   },
    { label: m.stageUpcomingVisits,     value: visitsCount,        icon: <CalendarClock />, clr: 'sky',     bg: 'bg-sky-50     text-sky-600     ring-sky-100'     },
    { label: m.stageActiveReservations, value: reservationsCount,  icon: <BookmarkCheck />, clr: 'emerald', bg: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: m.stageMonthContracts,     value: contractsCount,     icon: <FileText />,      clr: 'violet',  bg: 'bg-violet-50  text-violet-600  ring-violet-100'  },
  ] as const;

  const pipelineStages = [
    { key: 'NEW',         label: m.stageLabelNew         },
    { key: 'INTERESTED',  label: m.stageLabelInterested  },
    { key: 'VISIT',       label: m.stageLabelVisit       },
    { key: 'NEGOTIATION', label: m.stageLabelNegotiation },
  ];

  const stageColors: Record<string, { color: string; bg: string }> = {
    NEW:         { color: 'text-slate-600',   bg: 'bg-slate-100'  },
    INTERESTED:  { color: 'text-blue-700',    bg: 'bg-blue-50'    },
    VISIT:       { color: 'text-brand-700',   bg: 'bg-brand-50'   },
    NEGOTIATION: { color: 'text-amber-700',   bg: 'bg-amber-50'   },
    WON:         { color: 'text-emerald-700', bg: 'bg-emerald-50' },
    LOST:        { color: 'text-red-700',     bg: 'bg-red-50'     },
  };

  const maxStage = Math.max(...pipelineStages.map((s) => stageGroups[s.key] ?? 0), 1);

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-hairline bg-canvas/30">
        <span className="h-8 w-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4 text-brand-600">
          <TrendingUp />
        </span>
        <div>
          <h3 className="text-[13.5px] font-bold text-navy leading-none">{m.pipelineTitle}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{m.pipelineDesc}</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Pipeline stages row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stages.map((s, i) => {
            const prev = i > 0 ? stages[i - 1]!.value : null;
            const rate = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
            return (
              <div key={s.label} className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-2 w-full justify-center">
                  {i > 0 && <div className="hidden sm:block h-px flex-1 bg-hairline" />}
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0 [&>svg]:h-4 [&>svg]:w-4 ring-1',
                    s.bg,
                  )}>
                    {s.icon}
                  </div>
                  {i < stages.length - 1 && <div className="hidden sm:block h-px flex-1 bg-hairline" />}
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{s.value}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">{s.label}</p>
                  {rate !== null && (
                    <p className={cn('text-[10px] font-semibold mt-0.5', rate > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                      {rate}{m.conversionSuffix}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage distribution bar */}
        {openLeads > 0 && (
          <div className="border-t border-hairline pt-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{m.pipelineStageDistLabel}</p>
            <div className="space-y-2">
              {pipelineStages.map((s) => {
                const count = stageGroups[s.key] ?? 0;
                const pct   = Math.round((count / maxStage) * 100);
                const cfg   = stageColors[s.key]!;
                return count > 0 ? (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className={cn('text-[11px] font-medium w-[80px] shrink-0 text-end', cfg.color)}>{s.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn('h-full rounded-full', cfg.bg)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 tabular-nums w-4 shrink-0">{count}</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export async function SalesDashboard({ userId }: { userId: string }) {
  const locale = await getLocale();
  const m = uiT(locale).pages.salesHome;

  const nowIso = new Date().toISOString();

  const [leadsRes, reservationsRes, visitsRes, unitsRes, perfRes] = await Promise.all([
    safe(api.get<Paged<Lead>>('/leads?pageSize=100')),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=100')),
    safe(api.get<Paged<VisitAppointment>>(
      `/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${nowIso}&pageSize=50`,
    )),
    safe(api.get<Paged<unknown>>('/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${nowIso.slice(0, 7)}`)),
  ]);

  const leads        = leadsRes.data?.data        ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const visits       = (visitsRes.data?.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ── KPI computations ──────────────────────────────────────────────────────
  const openLeads          = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
  const wonLeads           = leads.filter((l) => l.stage === 'WON').length;
  const lostLeads          = leads.filter((l) => l.stage === 'LOST').length;
  const activeReservations = reservations.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED');
  const signedThisMonth    = (perfRes.data ?? [])[0]?.signedContractsCount;
  const convertedDeals     = reservations.filter((r) => r.status === 'CONVERTED').length;
  const closedDeals        = signedThisMonth ?? convertedDeals;
  const availableUnits     = unitsRes.data?.meta.total ?? 0;

  // Stale = NEW or INTERESTED stage and no activity for 3+ days
  const staleLeadsCount    = openLeads.filter(
    (l) => (l.stage === 'NEW' || l.stage === 'INTERESTED') && leadAgeDays(l) >= 3,
  ).length;
  const expiringWithin7    = reservations.filter((r) => {
    if (r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED') return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d <= 7;
  });
  const todayVisits = visits.filter((v) => isToday(v.scheduledAt));
  const expiringUrgent = reservations.filter((r) => {
    if (r.status === 'CONVERTED' || r.status === 'CANCELLED' || r.status === 'EXPIRED') return false;
    const d = daysUntil(r.expiresAt);
    return d >= 0 && d < 2;
  });

  // Stage distribution
  const stageGroups = openLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  }, {});

  // Content rows
  const recentLeads           = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const upcomingVisitRows     = visits.slice(0, 5);
  const activeReservationRows = [...activeReservations].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()).slice(0, 5);

  const showVisits       = !visitsRes.error && upcomingVisitRows.length > 0;
  const showReservations = !reservationsRes.error && activeReservationRows.length > 0;
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

      {/* ── KPI tiles ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile
          label={m.kpiOpenLeads}
          value={openLeads.length}
          sub={m.kpiOpenLeadsSub(wonLeads, lostLeads)}
          icon={<Zap />}
          topBar="from-brand-300 via-brand-500 to-brand-300"
          iconCls="bg-brand-50 text-brand-600 ring-1 ring-brand-100"
          valueCls="text-brand-700"
        />
        <KpiTile
          label={m.kpiStaleLeads}
          value={staleLeadsCount}
          sub={staleLeadsCount > 0 ? m.kpiStaleLeadsSubWarning : m.kpiStaleLeadsSubOk}
          icon={<AlertTriangle />}
          topBar={staleLeadsCount > 0 ? 'from-amber-300 via-amber-500 to-amber-300' : 'from-emerald-300 via-emerald-400 to-emerald-300'}
          iconCls={staleLeadsCount > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'}
          valueCls={staleLeadsCount > 0 ? 'text-amber-700' : 'text-emerald-700'}
        />
        <KpiTile
          label={m.kpiUpcomingVisits}
          value={visits.length}
          sub={todayVisits.length > 0 ? m.kpiUpcomingVisitsSubToday(todayVisits.length) : m.kpiUpcomingVisitsSubNone}
          icon={<CalendarClock />}
          topBar="from-sky-300 via-sky-500 to-sky-300"
          iconCls="bg-sky-50 text-sky-600 ring-1 ring-sky-100"
          valueCls="text-sky-700"
        />
        <KpiTile
          label={m.kpiActiveReservations}
          value={activeReservations.length}
          sub={expiringWithin7.length > 0 ? m.kpiActiveReservationsSubWarning(expiringWithin7.length) : m.kpiActiveReservationsSubOk}
          icon={<BookmarkCheck />}
          topBar={expiringWithin7.length > 0 ? 'from-amber-300 via-amber-500 to-amber-300' : 'from-emerald-300 via-emerald-500 to-emerald-300'}
          iconCls={expiringWithin7.length > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'}
          valueCls={expiringWithin7.length > 0 ? 'text-amber-700' : 'text-emerald-700'}
        />
        <KpiTile
          label={m.kpiMonthContracts}
          value={closedDeals}
          sub={signedThisMonth !== undefined ? m.kpiMonthContractsSigned : m.kpiMonthContractsConverted}
          icon={<FileText />}
          topBar="from-violet-300 via-violet-500 to-violet-300"
          iconCls="bg-violet-50 text-violet-600 ring-1 ring-violet-100"
          valueCls="text-violet-700"
        />
        <KpiTile
          label={m.kpiAvailableUnits}
          value={availableUnits}
          sub={m.kpiAvailableUnitsSub}
          icon={<Home />}
          topBar="from-teal-300 via-teal-500 to-teal-300"
          iconCls="bg-teal-50 text-teal-600 ring-1 ring-teal-100"
          valueCls="text-teal-700"
        />
      </div>

      {/* ── Sales pipeline ────────────────────────────────────────────────── */}
      <SalesPipeline
        openLeads={openLeads.length}
        visitsCount={visits.length}
        reservationsCount={activeReservations.length}
        contractsCount={closedDeals}
        stageGroups={stageGroups}
        m={m}
      />

      {/* ── Today priorities ──────────────────────────────────────────────── */}
      {hasPriorities && (
        <div className="space-y-2.5">
          <SectionLabel>{m.sectionTodayPriorities}</SectionLabel>
          <TodayPriorityPanel todayVisits={todayVisits} expiringUrgent={expiringUrgent} m={m} expiryLabel={expiryLabel} />
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
              {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} />)}
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
                {upcomingVisitRows.map((v) => <VisitRow key={v.id} visit={v} m={m} />)}
              </SectionCard>
              <SectionCard
                title={m.cardActiveReservations}
                icon={<BookmarkCheck />}
                iconCls="bg-emerald-50 ring-emerald-100 text-emerald-600"
                href="/dashboard/reservations"
                hrefLabel={m.cardReservationsLink}
                error={reservationsRes.error}
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
              {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} />)}
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
                {upcomingVisitRows.map((v) => <VisitRow key={v.id} visit={v} m={m} />)}
              </SectionCard>
            )}
            {showReservations && (
              <SectionCard
                title={m.cardActiveReservations}
                icon={<BookmarkCheck />}
                iconCls="bg-emerald-50 ring-emerald-100 text-emerald-600"
                href="/dashboard/reservations"
                hrefLabel={m.cardReservationsLink}
                error={reservationsRes.error}
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
            {recentLeads.map((l) => <LeadRow key={l.id} lead={l} m={m} />)}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── Row sub-components ────────────────────────────────────────────────────────
function LeadRow({ lead: l, m }: { lead: Lead; m: ReturnType<typeof uiT>['pages']['salesHome'] }) {
  const age     = leadAgeDays(l);
  const isStale = !l.upcomingVisit && age >= 3;
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
          <span className="tabular-nums">{formatDate(l.createdAt)}</span>
        </p>
      </div>
      <LeadStageBadge stage={l.stage} />
    </Link>
  );
}

function VisitRow({ visit: v, m }: { visit: VisitAppointment; m: ReturnType<typeof uiT>['pages']['salesHome'] }) {
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
            {formatDateTime(v.scheduledAt)}
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
  todayVisits, expiringUrgent, m, expiryLabel,
}: {
  todayVisits:    VisitAppointment[];
  expiringUrgent: Reservation[];
  m: ReturnType<typeof uiT>['pages']['salesHome'];
  expiryLabel: (dateStr: string) => string;
}) {
  const total = todayVisits.length + expiringUrgent.length;
  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
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
                  <span className="font-bold text-sky-700 tabular-nums">{formatDateTime(v.scheduledAt)}</span>
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
    <div className={cn('bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-hairline bg-canvas/30">
        <div className="flex items-center gap-3">
          <span className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ring-1 [&>svg]:h-4 [&>svg]:w-4', iconCls)}>
            {icon}
          </span>
          <h3 className="text-[13.5px] font-bold text-navy leading-none">{title}</h3>
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
