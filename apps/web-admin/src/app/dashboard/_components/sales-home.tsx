import { Zap, CalendarClock, BookmarkCheck, Home, Plus, CalendarPlus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, getReportsCurrency, currencySymbol, todayIn } from '@/lib/currency';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts } from '@/lib/format';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { ReservationStatusBadge } from '@/components/badges';
import {
  CommandBand,
  BandAction,
  TargetRing,
  StatTile,
  Panel,
  LeadBoard,
  Agenda,
  ExpiryCards,
} from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, greeting, daysLeftInMonth, daysUntil, loadBoard, buildAgenda } from './cockpit-data';

interface PerformanceRow {
  salesId: string;
  signedContractsCount: number;
  realizedValue: number;
  targetAmount: number | null;
  targetUnits: number | null;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
}

/**
 * The sales rep's home, a cockpit: the month's target in a navy command band,
 * four live tiles, the lead board (newest leads per stage) beside the agenda,
 * then the active bookings by how soon they lapse.
 */
export async function SalesDashboard({ userId }: { userId: string }) {
  const [locale, timeZone, currency, session] = await Promise.all([
    getLocale(), getCompanyTimeZone(), getReportsCurrency(), getSession(),
  ]);
  const t = uiT(locale).pages;
  const c = t.cockpit;
  const m = t.salesHome;
  const symbol = currencySymbol(currency, locale);
  const today = todayIn(timeZone);
  const period = today.slice(0, 7);

  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  const in7Iso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Every count is the server's (meta.total / facets), never a counted page.
  const [leadsRes, staleRes, resvRes, activeRes, expiringRes, visitsRes, unitsRes, perfRes] = await Promise.all([
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
    safe(api.get<Paged<Reservation>>('/reservations?status=PENDING,APPROVED&sort=expiresAt&pageSize=6')),
    safe(api.get<Paged<Reservation>>(`/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${in7Iso}&sort=expiresAt&pageSize=20`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${nowIso}&open=true&pageSize=12`)),
    safe(api.get<Paged<unknown>>('/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
  ]);

  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resv = resvRes.data?.meta.facets?.counts?.status ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;
  const activeReservations = (resv.PENDING ?? 0) + (resv.APPROVED ?? 0);
  const expiring7 = expiringRes.data?.meta.total ?? 0;
  const availableUnits = unitsRes.data?.meta.total ?? 0;
  const visits = (visitsRes.data?.data ?? []).slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const upcomingVisits = visitsRes.data?.meta.total ?? 0;
  const todayVisits = visits.filter((v) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(v.scheduledAt)) === today).length;
  const me = (perfRes.data ?? []).find((r) => r.salesId === userId) ?? (perfRes.data ?? [])[0];
  const lapsing = (expiringRes.data?.data ?? []).filter((r) => daysUntil(r.expiresAt) <= 2);

  const stageLabels = {
    NEW: m.stageLabelNew,
    INTERESTED: m.stageLabelInterested,
    VISIT: m.stageLabelVisit,
    NEGOTIATION: m.stageLabelNegotiation,
  };
  const board = await loadBoard(stages, c, locale, false, stageLabels);
  const agenda = buildAgenda(visits, lapsing, c, locale, timeZone, false);

  const money = (n: number) => compactParts(n, symbol, locale).join(' ');
  const pct = me?.targetAmountPercent ?? null;
  const hasTarget = !!me?.targetAmount;

  return (
    <div className="space-y-6">
      <CommandBand
        kicker={c.repSubtitle}
        greeting={greeting(c, timeZone, session?.fullName ?? '')}
        summary={c.todaySummary(todayVisits, stale)}
        actions={
          <>
            <BandAction primary href="/dashboard/leads/new" icon={<Plus />}>{m.btnAddLead}</BandAction>
            <BandAction href="/dashboard/visits/new" icon={<CalendarPlus />}>{m.btnScheduleVisit}</BandAction>
            <BandAction href="/dashboard/reservations/new" icon={<BookmarkCheck />}>{m.btnCreateReservation}</BandAction>
          </>
        }
        ring={
          <>
            <TargetRing pct={hasTarget ? pct : 0}>
              <span className="text-[30px] font-bold leading-none tabular-nums">{hasTarget ? `${Math.round(pct ?? 0)}%` : '—'}</span>
              <span className="mt-1 text-[11px] text-[#A9B0BD]">{c.monthTarget}</span>
            </TargetRing>
            <div className="space-y-1.5 text-[13px]">
              <p className="font-bold text-[#F4ECD8]">
                {hasTarget ? c.ofTarget(money(me!.achievedAmount), money(me!.targetAmount!)) : c.noTarget}
              </p>
              {me?.targetUnits ? (
                <p className="text-[#A9B0BD]">{me.achievedUnits} / {me.targetUnits} {c.units}</p>
              ) : null}
              <p className="text-[#D8B66A]">{c.daysLeft(daysLeftInMonth(today))}</p>
            </div>
          </>
        }
        facts={[
          { label: c.realized, value: money(me?.realizedValue ?? 0) },
          { label: c.contractsMonth, value: me?.signedContractsCount ?? 0 },
          { label: c.unitsSold, value: me?.achievedUnits ?? 0 },
          {
            label: c.avgDeal,
            value: me && me.signedContractsCount > 0 ? money(me.realizedValue / me.signedContractsCount) : '—',
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          href="/dashboard/leads" icon={<Zap />} tone="brand"
          label={c.openLeads} value={openLeads}
          note={c.staleHint(stale)} noteTone={stale > 0 ? 'warning' : 'success'}
        />
        <StatTile
          href="/dashboard/visits?tab=appointments" icon={<CalendarClock />} tone="sky"
          label={c.upcomingVisits} value={upcomingVisits}
          note={c.todayCount(todayVisits)}
        />
        <StatTile
          href="/dashboard/reservations" icon={<BookmarkCheck />} tone="violet"
          label={c.activeReservations} value={activeReservations}
          note={c.expiringSoon(expiring7)} noteTone={expiring7 > 0 ? 'warning' : 'success'}
        />
        <StatTile
          href="/dashboard/units" icon={<Home />} tone="emerald"
          label={c.availableUnits} value={availableUnits}
          note={m.kpiAvailableUnitsSub}
        />
      </div>

      <Panel
        testId="lead-board-panel"
        title={c.board}
        sub={c.boardSub}
        link={{ href: '/dashboard/leads', label: c.viewAll }}
      >
        <LeadBoard columns={board} emptyLabel={c.boardEmpty} viewAllLabel={c.viewAll} staleLabel={c.stale} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <Panel title={c.agenda} sub={c.agendaSub} link={{ href: '/dashboard/visits?tab=appointments', label: c.viewAll }}>
          <Agenda items={agenda} emptyLabel={c.agendaEmpty} />
        </Panel>
        <Panel
          className="xl:col-span-2"
          title={c.reservationsTitle}
          sub={c.reservationsSub}
          link={{ href: '/dashboard/reservations', label: c.viewAll }}
        >
          <ExpiryCards
            cols={2}
            emptyLabel={c.reservationsEmpty}
            items={(activeRes.data?.data ?? []).map((r) => ({
              id: r.id,
              href: `/dashboard/reservations/${r.id}`,
              code: r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`,
              unit: r.unit?.code,
              client: r.lead?.fullName ?? r.client?.fullName ?? '—',
              daysLeft: daysUntil(r.expiresAt),
              expiryLabel: c.expiresIn(daysUntil(r.expiresAt)),
              status: <ReservationStatusBadge status={r.status} locale={locale} />,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
