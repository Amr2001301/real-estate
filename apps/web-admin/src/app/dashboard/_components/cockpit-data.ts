import { api, safe } from '@/lib/api';
import type { Lead, Paged, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate, formatTime, tx } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { BOARD_STAGES, type AgendaItem, type BoardCard } from '@/components/cockpit/cockpit';

/** A NEW or INTERESTED lead this many days old with no visit booked is idle. */
export const STALE_AFTER_DAYS = 3;

type C = ReturnType<typeof uiT>['pages']['cockpit'];

/** Calendar date (YYYY-MM-DD) of a moment in the company's zone. */
function dayIn(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function greeting(c: C, timeZone: string, name: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const first = name.trim().split(/\s+/)[0] ?? name;
  return `${hour < 12 ? c.greetMorning : c.greetEvening}، ${first}`;
}

/** Days left in the company's current month after today. */
export function daysLeftInMonth(today: string): number {
  const [y, mo, d] = today.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return last - d;
}

export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** Newest three leads in each open stage, with the stage totals from the facets. */
export async function loadBoard(stageCounts: Record<string, number>, c: C, locale: Locale, withOwner: boolean, stageLabels: Record<string, string>) {
  const pages = await Promise.all(
    BOARD_STAGES.map((s) => safe(api.get<Paged<Lead>>(`/leads?stage=${s.stage}&pageSize=3`))),
  );
  return BOARD_STAGES.map((s, i) => {
    const rows = pages[i]?.data?.data ?? [];
    const cards: BoardCard[] = rows.map((l) => {
      const age = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000);
      return {
        id: l.id,
        name: l.client?.fullName ?? l.fullName,
        project: l.projectInterest ? tx(l.projectInterest.name, locale) : undefined,
        age: c.age(age),
        stale: (s.stage === 'NEW' || s.stage === 'INTERESTED') && !l.upcomingVisit && age >= STALE_AFTER_DAYS,
        owner: withOwner ? l.assignedSales?.fullName : undefined,
      };
    });
    return { stage: s.stage, label: stageLabels[s.stage] ?? s.stage, count: stageCounts[s.stage] ?? 0, cards };
  });
}

/** Upcoming visits and the bookings lapsing within two days, grouped by day. */
export function buildAgenda(
  visits: VisitAppointment[],
  lapsing: Reservation[],
  c: C,
  locale: Locale,
  timeZone: string,
  withOwner: boolean,
): AgendaItem[] {
  const today = dayIn(new Date(), timeZone);
  const tomorrow = dayIn(new Date(Date.now() + 86400000), timeZone);
  const label = (iso: string) => {
    const d = dayIn(new Date(iso), timeZone);
    return d === today ? c.today : d === tomorrow ? c.tomorrow : formatDate(iso, locale, timeZone);
  };
  const items: Array<AgendaItem & { at: number }> = [
    ...visits.map((v) => ({
      id: `v-${v.id}`,
      href: `/dashboard/visits/appointments/${v.id}`,
      day: label(v.scheduledAt),
      time: formatTime(v.scheduledAt, locale, timeZone),
      title: v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber,
      sub: [v.project ? tx(v.project.name, locale) : null, withOwner ? v.assignedSales?.fullName : null]
        .filter(Boolean).join(' · ') || v.visitNumber,
      tone: 'visit' as const,
      at: new Date(v.scheduledAt).getTime(),
    })),
    ...lapsing.map((r) => ({
      id: `r-${r.id}`,
      href: `/dashboard/reservations/${r.id}`,
      day: label(r.expiresAt),
      time: formatTime(r.expiresAt, locale, timeZone),
      title: `${r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}${r.unit?.code ? ` · ${r.unit.code}` : ''}`,
      sub: c.expiresIn(daysUntil(r.expiresAt)),
      tone: daysUntil(r.expiresAt) <= 0 ? ('danger' as const) : ('warning' as const),
      at: new Date(r.expiresAt).getTime(),
    })),
  ];
  return items.sort((a, b) => a.at - b.at).slice(0, 5).map(({ at: _at, ...it }) => it);
}
