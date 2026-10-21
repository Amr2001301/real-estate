import { Plus, CalendarPlus, Target, Wallet, Clock, AlertTriangle, UserX, Hourglass, PhoneCall } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, getReportsCurrency, currencySymbol, todayIn } from '@/lib/currency';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts } from '@/lib/format';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  DayHeader,
  DayAction,
  FigureBar,
  Panel,
  DayStrip,
  Timeline,
  TaskList,
  TeamList,
  PipelineSplit,
  Amount,
} from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, AGENDA_DAYS, greeting, daysLeftInMonth, dayTitle, buildWeek } from './cockpit-data';

interface PerformanceRow {
  salesId:                 string;
  salesName:               string;
  leadsCount:              number;
  openLeadsCount:          number;
  visitsCount:             number;
  reservationsCount:       number;
  signedContractsCount:    number;
  realizedValue:           number;
  targetAmount:            number | null;
  targetUnits:             number | null;
  achievedAmount:          number;
  achievedUnits:           number;
  targetAmountPercent:     number | null;
}

/**
 * The sales manager's home, the team's day: the team target in a quiet
 * header, one row of figures, the team's week agenda beside what needs the
 * manager, then the team against its targets and the open leads by stage.
 */
export async function SalesManagerDashboard({ day }: { day?: string }) {
  const [locale, timeZone, currency, session] = await Promise.all([
    getLocale(), getCompanyTimeZone(), getReportsCurrency(), getSession(),
  ]);
  const t = uiT(locale).pages;
  const c = t.cockpit;
  const m = t.salesManagerHome;
  const symbol = currencySymbol(currency, locale);
  const today = todayIn(timeZone);
  const period = today.slice(0, 7);
  const periodLabel = `${m.monthsAr[Number(period.slice(5, 7)) - 1] ?? period} ${period.slice(0, 4)}`;

  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  const fromIso = new Date(now.getTime() - 86400000).toISOString();
  const toIso = new Date(now.getTime() + (AGENDA_DAYS + 1) * 86400000).toISOString();
  const in7Iso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Team-scoped by the API; every count is the server's (meta.total / facets).
  const [perfRes, leadsRes, staleRes, resvRes, expiringRes, visitsRes, unconfirmedRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
    safe(api.get<Paged<Reservation>>(`/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${toIso}&sort=expiresAt&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?scheduledFrom=${fromIso}&scheduledTo=${toIso}&open=true&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?status=SCHEDULED&scheduledFrom=${nowIso}&pageSize=1`)),
  ]);

  const perf = (perfRes.data ?? []).slice().sort((a, b) => b.realizedValue - a.realizedValue);
  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resv = resvRes.data?.meta.facets?.counts?.status ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;
  const activeReservations = (resv.PENDING ?? 0) + (resv.APPROVED ?? 0);
  const pending = resv.PENDING ?? 0;
  const expiring = expiringRes.data?.data ?? [];
  const expiring7 = expiring.filter((r) => r.expiresAt <= in7Iso).length;

  // Team target: only the sales of reps who have one count toward it (a rep
  // with no target pushed the team past 100%).
  const sum = (pick: (r: PerformanceRow) => number) => perf.reduce((a, r) => a + pick(r), 0);
  const teamTarget = sum((r) => r.targetAmount ?? 0);
  const teamOnTarget = sum((r) => (r.targetAmount ? r.achievedAmount : 0));
  const teamPct = teamTarget > 0 ? (teamOnTarget / teamTarget) * 100 : null;
  const isActive = (r: PerformanceRow) => r.leadsCount + r.visitsCount + r.reservationsCount + r.signedContractsCount > 0;
  const activeReps = perf.filter(isActive).length;
  const inactive = perf.filter((r) => !isActive(r));
  const money = (n: number) => compactParts(n, symbol, locale).join(' ');
  const amount = (n: number) => <Amount parts={compactParts(n, symbol, locale)} />;

  const week = buildWeek(today, visitsRes.data?.data ?? [], expiring, locale, timeZone, true);
  const selected = week.find((d) => d.key === day) ?? week[0]!;
  const next = week.find((d) => d.key > selected.key && d.events.length > 0);
  const upcomingVisits = week.reduce((a, d) => a + d.events.filter((e) => e.tag === 'visit').length, 0);
  const todayVisits = week[0]!.events.filter((e) => e.tag === 'visit').length;
  const head = dayTitle(today, locale);

  return (
    <div className="space-y-6">
      <DayHeader
        kicker={greeting(c, timeZone, session?.fullName ?? '')}
        title={head.weekday}
        date={`${head.date} · ${c.managerSubtitle}`}
        target={{
          label: c.teamTarget,
          pct: teamPct,
          detail: teamTarget > 0 ? c.ofTarget(money(teamOnTarget), money(teamTarget)) : c.noTarget,
          note: c.daysLeft(daysLeftInMonth(today)),
        }}
        actions={
          <>
            <DayAction primary href="/dashboard/leads/new" icon={<Plus />}>{m.btnAddLead}</DayAction>
            <DayAction href="/dashboard/visits/new" icon={<CalendarPlus />}>{m.btnScheduleVisit}</DayAction>
            <DayAction href="/dashboard/targets" icon={<Target />}>{c.manageTargets}</DayAction>
            <DayAction href="/dashboard/my-compensation" icon={<Wallet />}>{m.btnMyCompensation}</DayAction>
          </>
        }
      />

      <FigureBar
        figures={[
          { label: c.openLeads, value: openLeads, sub: c.staleHint(stale), warn: stale > 0, href: '/dashboard/leads' },
          { label: c.upcomingVisits, value: upcomingVisits, sub: c.todayCount(todayVisits), href: '/dashboard/visits?tab=appointments' },
          { label: c.activeReservations, value: activeReservations, sub: c.expiringSoon(expiring7), warn: expiring7 > 0, href: '/dashboard/reservations' },
          { label: c.contractsMonth, value: sum((r) => r.signedContractsCount), sub: `${sum((r) => r.achievedUnits)} ${c.unitsSold}` },
          { label: c.realized, value: amount(sum((r) => r.realizedValue)) },
          { label: c.team, value: activeReps, sub: c.activeOfTeam(perf.length), warn: activeReps < perf.length },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <Panel
          testId="agenda"
          className="xl:col-span-2"
          title={c.teamAgenda}
          sub={c.dayEvents(selected.events.length)}
          link={{ href: '/dashboard/visits?tab=appointments', label: c.viewAll }}
        >
          <DayStrip days={week} selected={selected.key} countLabel={c.dayEvents} />
          <Timeline
            events={selected.events}
            tags={{ visit: c.tagVisit, expiry: c.tagExpiry }}
            empty={{
              label: c.dayEmpty,
              next: next ? { href: `/dashboard?day=${next.key}`, label: `${c.nextUp}: ${next.weekday} ${next.dayNum}` } : undefined,
            }}
          />
        </Panel>

        <div className="space-y-5">
          <Panel testId="attention" title={c.attention}>
            <TaskList
              empty={c.attentionEmpty}
              tasks={[
                { key: 'pending', icon: <Hourglass />, tone: 'violet', label: c.approvals, desc: c.approvalsDesc, count: pending, href: '/dashboard/reservations?status=PENDING' },
                { key: 'lapsing', icon: <Clock />, tone: 'rose', label: c.lapsingWeek, desc: c.lapsingDesc, count: expiring7, href: '/dashboard/reservations' },
                { key: 'follow', icon: <AlertTriangle />, tone: 'amber', label: c.followUps, desc: c.followUpsDesc, count: stale, href: '/dashboard/leads?stage=NEW,INTERESTED' },
                { key: 'unconfirmed', icon: <PhoneCall />, tone: 'sky', label: c.unconfirmed, desc: c.unconfirmedDesc, count: unconfirmedRes.data?.meta.total ?? 0, href: '/dashboard/visits?tab=appointments' },
                {
                  key: 'inactive', icon: <UserX />, tone: 'rose', label: c.inactiveReps, count: inactive.length,
                  desc: inactive.slice(0, 3).map((r) => r.salesName).join(m.listSeparator) +
                    (inactive.length > 3 ? m.alertInactiveRepsMore(inactive.length - 3) : ''),
                },
              ]}
            />
          </Panel>
          <Panel title={c.pipeline} link={{ href: '/dashboard/leads', label: c.viewAll }}>
            <PipelineSplit
              stages={[
                { stage: 'NEW', label: m.stageLabelNew, count: stages.NEW ?? 0 },
                { stage: 'INTERESTED', label: m.stageLabelInterested, count: stages.INTERESTED ?? 0 },
                { stage: 'VISIT', label: m.stageLabelVisit, count: stages.VISIT ?? 0 },
                { stage: 'NEGOTIATION', label: m.stageLabelNegotiation, count: stages.NEGOTIATION ?? 0 },
              ]}
            />
          </Panel>
        </div>
      </div>

      <Panel
        testId="leaderboard"
        title={c.leaderboard}
        sub={c.teamSub(periodLabel)}
        link={{ href: '/dashboard/sales/performance', label: c.viewAll }}
      >
        <TeamList
          empty={m.teamPerfEmpty}
          rows={perf.map((r) => ({
            id: r.salesId,
            name: r.salesName,
            pct: r.targetAmount ? r.targetAmountPercent : null,
            contracts: `${r.signedContractsCount} ${c.contracts}`,
            realized: money(r.realizedValue),
            inactive: isActive(r) ? undefined : c.inactive,
          }))}
        />
      </Panel>
    </div>
  );
}
