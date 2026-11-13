import Link from 'next/link';
import { Plus, Users, Megaphone, AlertTriangle, PhoneCall } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getCompanyTimeZone, todayIn } from '@/lib/currency';
import type { Paged, Lead, VisitAppointment } from '@/lib/types';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { FollowUpsPanel } from '@/components/crm/follow-ups-panel';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { PremiumPageHero, PremiumMetricStrip } from '@/components/premium';
import { Panel, DayStrip, Timeline, TaskList } from '@/components/cockpit/cockpit';
import { STALE_AFTER_DAYS, AGENDA_DAYS, greeting, dayTitle, buildWeek } from './cockpit-data';

/** The open stages on the navy band, light to deep: how far each lead has come. */
const STAGE_COLORS = {
  NEW: '#F4ECD8',
  INTERESTED: '#E2C989',
  VISIT: '#C79A3B',
  NEGOTIATION: '#5E7F6B',
} as const;

/**
 * BRK-1 — a brokerage company's home, in the developer home's look: the
 * greeting, then one navy band with the pipeline (open, new this month, how
 * far the open leads have come, visits) and the open leads by stage across
 * its foot; the week's
 * visits beside the follow-ups and what needs attention. No reservations or
 * contracts: deals and commissions come in the next brokerage phases.
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
  const monthStart = `${today.slice(0, 8)}01`;
  const [leadsRes, monthRes, staleRes, visitsRes, unconfirmedRes] = await Promise.all([
    safe(api.get<Paged<Lead>>('/leads?pageSize=1')),
    safe(api.get<Paged<Lead>>(`/leads?dateFrom=${monthStart}&pageSize=1`)),
    safe(api.get<Paged<Lead>>(`/leads?stage=NEW,INTERESTED&createdBefore=${staleIso}&pageSize=1`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?scheduledFrom=${fromIso}&scheduledTo=${toIso}&open=true&pageSize=100`)),
    safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?status=SCHEDULED&scheduledFrom=${nowIso}&pageSize=1`)),
  ]);

  const stages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const openLeads = (leadsRes.data?.meta.total ?? 0) - (stages.WON ?? 0) - (stages.LOST ?? 0);
  const stale = staleRes.data?.meta.total ?? 0;
  // How much of the open pipeline has reached a visit or a negotiation.
  // (Closed deals come with the deals phase: a brokerage has no contracts yet.)
  const advanced = (stages.VISIT ?? 0) + (stages.NEGOTIATION ?? 0);
  const advancedPct = openLeads > 0 ? Math.round((advanced / openLeads) * 100) : null;

  const week = buildWeek(today, visitsRes.data?.data ?? [], [], locale, timeZone, true);
  const selected = week.find((d) => d.key === day) ?? week[0]!;
  const next = week.find((d) => d.key > selected.key && d.events.length > 0);
  const upcomingVisits = week.reduce((a, d) => a + d.events.filter((e) => e.tag === 'visit').length, 0);
  const todayVisits = week[0]!.events.filter((e) => e.tag === 'visit').length;
  const head = dayTitle(today, locale);

  return (
    <div className="flex flex-col gap-6" data-testid="brokerage-home">
      <PremiumPageHero
        eyebrow={`${head.weekday}${locale === 'ar' ? '،' : ','} ${head.date} · ${b.subtitle}`}
        title={greeting(c, timeZone, session?.fullName ?? '')}
        description={b.description}
        actions={
          <>
            <Link href={'/dashboard/campaigns' as never}>
              <Button variant="outline" size="md" leftIcon={<Megaphone className="h-4 w-4" />}>{b.campaigns}</Button>
            </Link>
            {/* No «schedule a visit» yet: a visit needs a listing (brokerage phase 2). */}
            <Link href={'/dashboard/leads' as never}>
              <Button variant="outline" size="md" leftIcon={<Users className="h-4 w-4" />}>{b.leadsList}</Button>
            </Link>
            <Link href={'/dashboard/leads/new' as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>{m.btnAddLead}</Button>
            </Link>
          </>
        }
      >
        <PremiumMetricStrip
          cols={4}
          metrics={[
            {
              label: c.openLeads, value: openLeads, sub: c.staleHint(stale),
              trend: stale > 0 ? c.followUps : undefined, trendCls: 'warning',
            },
            { label: b.newThisMonth, value: monthRes.data?.meta.total ?? 0, sub: b.awaitingFirstContact(stages.NEW ?? 0) },
            {
              label: b.advanced, value: advancedPct ?? '—', unit: advancedPct !== null ? '%' : '',
              ring: advancedPct ?? undefined, sub: advancedPct !== null ? b.advancedSub : b.advancedNone,
            },
            { label: c.upcomingVisits, value: upcomingVisits, sub: c.todayCount(todayVisits) },
          ]}
          distribution={[
            { label: m.stageLabelNew, value: stages.NEW ?? 0, color: STAGE_COLORS.NEW },
            { label: m.stageLabelInterested, value: stages.INTERESTED ?? 0, color: STAGE_COLORS.INTERESTED },
            { label: m.stageLabelVisit, value: stages.VISIT ?? 0, color: STAGE_COLORS.VISIT },
            { label: m.stageLabelNegotiation, value: stages.NEGOTIATION ?? 0, color: STAGE_COLORS.NEGOTIATION },
          ]}
        />
      </PremiumPageHero>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
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

        <div className="flex flex-col gap-6">
          <Panel testId="attention" title={c.attention}>
            <TaskList
              empty={c.attentionEmpty}
              tasks={[
                { key: 'follow', icon: <AlertTriangle />, tone: 'amber', label: c.followUps, desc: c.followUpsDesc, count: stale, href: '/dashboard/leads?stage=NEW,INTERESTED' },
                { key: 'unconfirmed', icon: <PhoneCall />, tone: 'sky', label: c.unconfirmed, desc: c.unconfirmedDesc, count: unconfirmedRes.data?.meta.total ?? 0, href: '/dashboard/visits?tab=appointments' },
              ]}
            />
          </Panel>
          <FollowUpsPanel locale={locale} />
        </div>
      </div>
    </div>
  );
}
