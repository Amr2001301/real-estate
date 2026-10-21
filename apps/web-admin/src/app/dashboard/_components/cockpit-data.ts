import type { Reservation, VisitAppointment } from '@/lib/types';
import { formatTime, intlLocale, tx } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { AgendaDay, DayEvent } from '@/components/cockpit/cockpit';

/** A NEW or INTERESTED lead this many days old with no visit booked is idle. */
export const STALE_AFTER_DAYS = 3;

/** Days the agenda strip covers, today first. */
export const AGENDA_DAYS = 7;

type C = ReturnType<typeof uiT>['pages']['cockpit'];

/** Calendar date (YYYY-MM-DD) of a moment in the company's zone. */
export function dayIn(d: Date, timeZone: string): string {
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

/** Noon UTC on a calendar day: formats as that same day in any zone within ±11h. */
function noonOf(key: string, plusDays = 0): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + plusDays, 12));
}

/** The weekday and the full date of a calendar day, for the header. */
export function dayTitle(key: string, locale: Locale): { weekday: string; date: string } {
  const at = noonOf(key);
  const loc = intlLocale(locale);
  return {
    weekday: new Intl.DateTimeFormat(loc, { weekday: 'long', timeZone: 'UTC' }).format(at),
    date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(at),
  };
}

/**
 * The week from today, each day with its visits and the bookings that lapse
 * on it, in time order. Days are the company's calendar days.
 */
export function buildWeek(
  today: string,
  visits: VisitAppointment[],
  expiring: Reservation[],
  locale: Locale,
  timeZone: string,
  withOwner: boolean,
): AgendaDay[] {
  const loc = intlLocale(locale);
  const days: AgendaDay[] = Array.from({ length: AGENDA_DAYS }, (_, i) => {
    const at = noonOf(today, i);
    return {
      key: at.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }).format(at),
      dayNum: new Intl.DateTimeFormat(loc, { day: 'numeric', timeZone: 'UTC' }).format(at),
      events: [],
    };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  const timed: Array<{ key: string; at: number; ev: DayEvent }> = [
    ...visits.map((v) => ({
      key: dayIn(new Date(v.scheduledAt), timeZone),
      at: new Date(v.scheduledAt).getTime(),
      ev: {
        id: `v-${v.id}`,
        href: `/dashboard/visits/appointments/${v.id}`,
        time: formatTime(v.scheduledAt, locale, timeZone),
        title: v.lead?.fullName ?? v.client?.fullName ?? v.visitNumber,
        sub: [v.project ? tx(v.project.name, locale) : null, withOwner ? v.assignedSales?.fullName : null]
          .filter(Boolean).join(' · ') || v.visitNumber,
        tag: 'visit' as const,
      },
    })),
    ...expiring.map((r) => ({
      key: dayIn(new Date(r.expiresAt), timeZone),
      at: new Date(r.expiresAt).getTime(),
      ev: {
        id: `r-${r.id}`,
        href: `/dashboard/reservations/${r.id}`,
        time: formatTime(r.expiresAt, locale, timeZone),
        title: r.lead?.fullName ?? r.client?.fullName ?? r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`,
        sub: [r.reservationNumber, r.unit?.code, withOwner ? r.sales?.fullName : null].filter(Boolean).join(' · '),
        tag: 'expiry' as const,
      },
    })),
  ];
  for (const t of timed.sort((a, b) => a.at - b.at)) byKey.get(t.key)?.events.push(t.ev);
  return days;
}
