import { BookmarkCheck, Plus, CalendarPlus, AlertTriangle, Clock, PhoneCall } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, getReportsCurrency, currencySymbol, todayIn } from '@/lib/currency';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts } from '@/lib/format';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { FollowUpsPanel } from '@/components/crm/follow-ups-panel';
import { uiT } from '@/messages/ui';
import {
  DayHeader,
  DayAction,
  FigureBar,
  Panel,
  DayStrip,
  Timeline,
  TaskList,
  PipelineSplit,
  Amount,
} from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, AGENDA_DAYS, greeting, daysLeftInMonth, dayTitle, buildWeek } from './cockpit-data';

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
 * The sales rep's home, a day planner: the day and the month's target in a
 * quiet header, one row of figures, the week's agenda around the selected day
 * (`?day=`), and beside it the day's tasks and the open leads by stage.
 */
export async function SalesDashboard({ userId, day }: { userId: string; day?: string }) {
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
  // A day back so this morning's visits stay on today; the week is cut by calendar day below.
  const fromIso = new Date(now.getTime() - 86400000).toISOString();
  const toIso = new Date(now.getTime() + (AGENDA_DAYS + 1) * 86400000).toISOString();
  const in7Iso = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Every count is the server's (meta.total / facets), never a counted page.
  const [leadsRes, staleRes, resvRes, expiringRes, visitsRes, unconfirmedRes, perfRes] = await Promise.all([
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<Reservation>>('/reservations?pageSize=1')),
    safe(api.get<Paged<Reservation>>(`/reservations?status=PENDING,APPROVED&expiresFrom=${nowIso}&expiresTo=${toIso}&sort=expiresAt&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?assignedSalesId=${userId}&scheduledFrom=${fromIso}&scheduledTo=${toIso}&open=true&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?assignedSalesId=${userId}&status=SCHEDULED&scheduledFrom=${nowIso}&pageSize=1`)),
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${period}`)),
  ]);

  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resv = resvRes.data?.meta.facets?.counts?.status ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;
  const activeReservations = (resv.PENDING ?? 0) + (resv.APPROVED ?? 0);
  const expiring = expiringRes.data?.data ?? [];
  const expiring7 = expiring.filter((r) => r.expiresAt <= in7Iso).length;
  const me = (perfRes.data ?? []).find((r) => r.salesId === userId) ?? (perfRes.data ?? [])[0];

  const week = buildWeek(today, visitsRes.data?.data ?? [], expiring, locale, timeZone, false);
  const selected = week.find((d) => d.key === day) ?? week[0]!;
  const next = week.find((d) => d.key > selected.key && d.events.length > 0);
  const upcomingVisits = week.reduce((a, d) => a + d.events.filter((e) => e.tag === 'visit').length, 0);
  const todayVisits = week[0]!.events.filter((e) => e.tag === 'visit').length;
  const head = dayTitle(today, locale);

  const money = (n: number) => compactParts(n, symbol, locale).join(' ');
  const amount = (n: number) => <Amount parts={compactParts(n, symbol, locale)} />;
  const hasTarget = !!me?.targetAmount;

  return (
    <div className="space-y-6">
      <DayHeader
        kicker={greeting(c, timeZone, session?.fullName ?? '')}
        title={head.weekday}
        date={`${head.date} · ${c.repSubtitle}`}
        target={{
          label: c.monthTarget,
          pct: hasTarget ? (me?.targetAmountPercent ?? 0) : null,
          detail: hasTarget ? c.ofTarget(money(me!.achievedAmount), money(me!.targetAmount!)) : c.noTarget,
          note: c.daysLeft(daysLeftInMonth(today)),
        }}
        actions={
          <>
            <DayAction primary href="/dashboard/leads/new" icon={<Plus />}>{m.btnAddLead}</DayAction>
            <DayAction href="/dashboard/visits/new" icon={<CalendarPlus />}>{m.btnScheduleVisit}</DayAction>
            <DayAction href="/dashboard/reservations/new" icon={<BookmarkCheck />}>{m.btnCreateReservation}</DayAction>
          </>
        }
      />

      <FigureBar
        figures={[
          { label: c.openLeads, value: openLeads, sub: c.staleHint(stale), warn: stale > 0, href: '/dashboard/leads' },
          { label: c.upcomingVisits, value: upcomingVisits, sub: c.todayCount(todayVisits), href: '/dashboard/visits?tab=appointments' },
          { label: c.activeReservations, value: activeReservations, sub: c.expiringSoon(expiring7), warn: expiring7 > 0, href: '/dashboard/reservations' },
          { label: c.contractsMonth, value: me?.signedContractsCount ?? 0, sub: `${me?.achievedUnits ?? 0} ${c.unitsSold}` },
          { label: c.realized, value: amount(me?.realizedValue ?? 0) },
          {
            label: c.avgDeal,
            value: me && me.signedContractsCount > 0 ? amount(me.realizedValue / me.signedContractsCount) : '—',
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:items-start">
        <Panel
          testId="agenda"
          className="xl:col-span-2"
          title={c.agenda}
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
          <FollowUpsPanel locale={locale} />
          <Panel title={c.tasks}>
            <TaskList
              empty={c.tasksEmpty}
              tasks={[
                { key: 'follow', icon: <AlertTriangle />, tone: 'amber', label: c.followUps, desc: c.followUpsDesc, count: stale, href: '/dashboard/leads?stage=NEW,INTERESTED' },
                { key: 'lapsing', icon: <Clock />, tone: 'rose', label: c.lapsingWeek, desc: c.lapsingDesc, count: expiring7, href: '/dashboard/reservations' },
                { key: 'unconfirmed', icon: <PhoneCall />, tone: 'sky', label: c.unconfirmed, desc: c.unconfirmedDesc, count: unconfirmedRes.data?.meta.total ?? 0, href: '/dashboard/visits?tab=appointments' },
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
    </div>
  );
}
