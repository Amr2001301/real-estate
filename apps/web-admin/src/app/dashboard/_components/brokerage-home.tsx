import { Plus, CalendarPlus, Megaphone, AlertTriangle, PhoneCall } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, todayIn } from '@/lib/currency';
import type { Paged, Lead, VisitAppointment } from '@/lib/types';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { FollowUpsPanel } from '@/components/crm/follow-ups-panel';
import { uiT } from '@/messages/ui';
import { DayHeader, DayAction, FigureBar, Panel, DayStrip, Timeline, TaskList, PipelineSplit } from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, AGENDA_DAYS, greeting, dayTitle, buildWeek } from './cockpit-data';

/**
 * BRK-1 — a brokerage company's home: the day of its pipeline. One row of
 * figures (open, new, visits, won, lost), the week's visits beside the
 * follow-ups and what needs attention, and the open leads by stage. No
 * reservations or contracts: those are the developer's (deals and commissions
 * come in the next brokerage phases).
 */
export async function BrokerageDashboard({ day }: { day?: string }) {
  const [locale, timeZone, session] = await Promise.all([getLocale(), getCompanyTimeZone(), getSession()]);
  const t = uiT(locale).pages;
  const c = t.cockpit;
  const m = t.salesManagerHome;
  const b = t.brokerageHome;
  const today = todayIn(timeZone);

  const now = new Date();
  const nowIso = now.toISOString();
  const staleIso = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  const fromIso = new Date(now.getTime() - 86400000).toISOString();
  const toIso = new Date(now.getTime() + (AGENDA_DAYS + 1) * 86400000).toISOString();

  // Scoped by the API to what this user may see; every count is the server's.
  const [leadsRes, staleRes, visitsRes, unconfirmedRes] = await Promise.all([
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?scheduledFrom=${fromIso}&scheduledTo=${toIso}&open=true&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?status=SCHEDULED&scheduledFrom=${nowIso}&pageSize=1`)),
  ]);

  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;

  const week = buildWeek(today, visitsRes.data?.data ?? [], [], locale, timeZone, true);
  const selected = week.find((d) => d.key === day) ?? week[0]!;
  const next = week.find((d) => d.key > selected.key && d.events.length > 0);
  const upcomingVisits = week.reduce((a, d) => a + d.events.filter((e) => e.tag === 'visit').length, 0);
  const todayVisits = week[0]!.events.filter((e) => e.tag === 'visit').length;
  const head = dayTitle(today, locale);

  return (
    <div className="space-y-6" data-testid="brokerage-home">
      <DayHeader
        kicker={greeting(c, timeZone, session?.fullName ?? '')}
        title={head.weekday}
        date={`${head.date} · ${b.subtitle}`}
        actions={
          <>
            <DayAction primary href="/dashboard/leads/new" icon={<Plus />}>{m.btnAddLead}</DayAction>
            <DayAction href="/dashboard/visits/new" icon={<CalendarPlus />}>{m.btnScheduleVisit}</DayAction>
            <DayAction href="/dashboard/campaigns" icon={<Megaphone />}>{b.campaigns}</DayAction>
          </>
        }
      />

      <FigureBar
        cols={5}
        figures={[
          { label: c.openLeads, value: openLeads, sub: c.staleHint(stale), warn: stale > 0, href: '/dashboard/leads' },
          { label: b.newLeads, value: stages.NEW ?? 0, sub: b.newLeadsSub, href: '/dashboard/leads?stage=NEW' },
          { label: c.upcomingVisits, value: upcomingVisits, sub: c.todayCount(todayVisits), href: '/dashboard/visits?tab=appointments' },
          { label: b.won, value: stages.WON ?? 0, sub: b.wonSub, href: '/dashboard/leads?stage=WON' },
          { label: b.lost, value: stages.LOST ?? 0, href: '/dashboard/leads?stage=LOST' },
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
          <FollowUpsPanel locale={locale} />
          <Panel testId="attention" title={c.attention}>
            <TaskList
              empty={c.attentionEmpty}
              tasks={[
                { key: 'follow', icon: <AlertTriangle />, tone: 'amber', label: c.followUps, desc: c.followUpsDesc, count: stale, href: '/dashboard/leads?stage=NEW,INTERESTED' },
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
