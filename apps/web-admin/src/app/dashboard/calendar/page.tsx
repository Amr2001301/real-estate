import Link from 'next/link';
import { CalendarCheck2, CalendarClock, ChevronLeft, ChevronRight, FileSignature, Hourglass, MapPin } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Translatable } from '@/lib/types';
import { tx } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { getCompanyTimeZone, todayIn } from '@/lib/currency';
import { staffOptions } from '@/lib/options';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumPanel } from '@/components/premium';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { calendarT } from '@/components/crm/calendar-messages';
import { KIND_ICON } from '@/components/crm/follow-up-icons';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type Sales = { id: string; fullName: string } | null;
type CalendarEvent =
  | { type: 'visit'; id: string; at: string; leadId: string | null; customer: string | null; project: Translatable | null; sales: Sales; status: string; ref: string }
  | { type: 'follow_up'; id: string; at: string; leadId: string; customer: string; project: Translatable | null; sales: Sales; kind: string; note: string | null }
  | { type: 'reservation_expiry'; id: string; at: string; leadId: string | null; customer: string | null; unit: string | null; project: Translatable | null; sales: Sales; status: string; ref: string | null }
  | { type: 'contract_signed'; id: string; at: string; customer: string | null; unit: string | null; project: Translatable | null; sales: Sales; ref: string | null }
  | { type: 'done'; id: string; at: string; leadId: string; customer: string; sales: Sales; kind: string; callResult: string | null };

interface Search {
  month?: string;
  day?: string;
  salesId?: string;
}

const MONTH = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000));

const TONE = {
  visit: 'border-s-violet-500 bg-violet-500/10 text-violet-800',
  follow_up: 'border-s-[#D8B66A] bg-[#D8B66A]/14 text-brand-800',
  overdue: 'border-s-danger-500 bg-danger-500/10 text-danger-700',
  done: 'border-s-emerald-500 bg-emerald-500/10 text-emerald-800',
  reservation_expiry: 'border-s-orange-500 bg-orange-500/10 text-orange-800',
  contract_signed: 'border-s-sky-600 bg-sky-500/10 text-sky-800',
} as const;
const DOT: Record<CalendarEvent['type'], string> = {
  visit: 'bg-violet-500',
  follow_up: 'bg-[#D8B66A]',
  done: 'bg-emerald-500',
  reservation_expiry: 'bg-orange-500',
  contract_signed: 'bg-sky-600',
};
const TYPES = ['visit', 'follow_up', 'done', 'reservation_expiry', 'contract_signed'] as const;

/** «التقويم» — visits, follow-ups due, logged calls, reservations running out and contracts signed, a month at a time. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, locale, session, zone] = await Promise.all([searchParams, getLocale(), getSession(), getCompanyTimeZone()]);
  const m = calendarT(locale);
  const today = todayIn(zone);
  const month = sp.month && MONTH.test(sp.month) ? sp.month : today.slice(0, 7);
  const first = `${month}-01`;
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const last = iso(new Date(Date.UTC(y, mo, 0)));
  // Weeks start on Saturday.
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 1) % 7;
  const gridStart = addDays(first, -lead);
  const trail = (6 - ((new Date(`${last}T00:00:00Z`).getUTCDay() + 1) % 7)) % 7;
  const gridEnd = addDays(last, trail);
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const selected = sp.day && DAY.test(sp.day) && sp.day >= gridStart && sp.day <= gridEnd ? sp.day : today >= first && today <= last ? today : first;

  const canPick = session?.role === 'ADMIN' || session?.role === 'SALES_MANAGER';
  const salesId = canPick && sp.salesId && /^[0-9a-f-]{36}$/i.test(sp.salesId) ? sp.salesId : '';
  const qs = new URLSearchParams({ from: gridStart, to: gridEnd, ...(salesId ? { salesId } : {}) });
  const [res, repsRes] = await Promise.all([
    safe(api.get<{ events: CalendarEvent[]; timeZone: string }>(`/leads/calendar?${qs.toString()}`)),
    canPick ? safe(staffOptions(['SALES', 'SALES_MANAGER'])) : Promise.resolve({ data: null, error: null }),
  ]);
  const tz = res.data?.timeZone ?? zone;
  const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeOf = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of res.data?.events ?? []) {
    const k = dayOf.format(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const now = Date.now();
  const tone = (e: CalendarEvent) => (e.type === 'follow_up' && Date.parse(e.at) < now ? TONE.overdue : TONE[e.type]);
  const label = (e: CalendarEvent) => {
    switch (e.type) {
      case 'visit':
        return m.visit;
      case 'follow_up':
        return m.kind[e.kind] ?? m.followUp;
      case 'reservation_expiry':
        return e.status === 'EXPIRED' ? m.reservationExpired : m.reservationExpiry;
      case 'contract_signed':
        return m.contractSigned;
      default:
        return `${m.kind[e.kind] ?? ''} ✓`;
    }
  };
  const href = (e: CalendarEvent) =>
    (e.type === 'visit'
      ? `/dashboard/visits/appointments/${e.id}`
      : e.type === 'reservation_expiry'
        ? `/dashboard/reservations/${e.id}`
        : e.type === 'contract_signed'
          ? `/dashboard/contracts/${e.id}`
          : `/dashboard/leads/${e.leadId}`) as never;
  const tally = (evs: CalendarEvent[]) => Object.fromEntries(TYPES.map((t) => [t, evs.filter((e) => e.type === t).length])) as Record<CalendarEvent['type'], number>;
  const link = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { month, salesId, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/dashboard/calendar?${p.toString()}` as never;
  };
  const prevMonth = iso(new Date(Date.UTC(y, mo - 2, 1))).slice(0, 7);
  const nextMonth = iso(new Date(Date.UTC(y, mo, 1))).slice(0, 7);
  const monthName = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${first}T00:00:00Z`));
  const dayName = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${selected}T00:00:00Z`));
  const selectedEvents = byDay.get(selected) ?? [];
  const inMonth = (res.data?.events ?? []).filter((e) => dayOf.format(new Date(e.at)).startsWith(month));

  return (
    <div className="space-y-6">
      <PremiumPageHero
        eyebrow={m.eyebrow}
        title={m.title}
        description={m.desc}
        breadcrumbs={[{ label: uiT(locale).common.breadcrumbHome, href: '/dashboard' }, { label: m.title }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-hairline bg-surface p-3">
        <div className="flex items-center gap-2">
          <Link href={link({ month: prevMonth, day: undefined })} aria-label={m.prev} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline hover:border-brand-500/50">
            <ChevronRight className="h-4 w-4 ltr:rotate-180" />
          </Link>
          <h2 className="min-w-[150px] text-center font-heading text-[19px] font-bold text-slate-900" data-testid="calendar-month">{monthName}</h2>
          <Link href={link({ month: nextMonth, day: undefined })} aria-label={m.next} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline hover:border-brand-500/50">
            <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
          </Link>
          <Link href={link({ month: today.slice(0, 7), day: today })} className="rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:border-brand-500/50">
            {m.today}
          </Link>
        </div>
        <p className="text-[12.5px] text-slate-500">{m.summary(tally(inMonth))}</p>
        {canPick && (
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="month" value={month} />
            <label className="text-[12px] font-semibold text-slate-500" htmlFor="cal-rep">{m.rep}</label>
            <select id="cal-rep" name="salesId" defaultValue={salesId} className="h-9 rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-700">
              <option value="">{m.everyone}</option>
              {(repsRes.data?.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
            <Button type="submit" variant="primary" size="sm">{m.apply}</Button>
          </form>
        )}
      </div>

      {res.error && <div role="alert" className="rounded-[20px] bg-danger-500/10 p-6 text-sm text-danger-600">{m.error}: {res.error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface" data-testid="calendar-grid">
          <div className="grid grid-cols-7 border-b border-hairline bg-navy-band">
            {m.weekdays.map((w) => (
              <div key={w} className="px-2 py-2.5 text-center text-[11.5px] font-semibold text-[#F4ECD8]">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const evs = byDay.get(d) ?? [];
              const outside = !d.startsWith(month);
              return (
                <Link
                  key={d}
                  href={link({ day: d })}
                  scroll={false}
                  data-testid="calendar-day"
                  data-day={d}
                  className={cn(
                    'min-h-[96px] border-b border-e border-hairline p-1.5 transition-colors hover:bg-surface-muted/50 sm:min-h-[118px]',
                    outside && 'bg-surface-muted/30',
                    d === selected && 'ring-2 ring-inset ring-[#D8B66A]',
                  )}
                >
                  <span
                    className={cn(
                      'num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px]',
                      d === today ? 'bg-navy-band text-white' : outside ? 'text-slate-400' : 'text-slate-700',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <ul className="mt-1 hidden space-y-1 sm:block">
                    {evs.slice(0, 3).map((e) => (
                      <li key={`${e.type}-${e.id}`} className={cn('truncate rounded-md border-s-2 px-1.5 py-0.5 text-[11px] font-semibold', tone(e))}>
                        <span className="tabular-nums opacity-70">{timeOf.format(new Date(e.at))}</span> {e.customer ?? label(e)}
                      </li>
                    ))}
                    {evs.length > 3 && <li className="px-1 text-[11px] font-semibold text-slate-500">{m.more(evs.length - 3)}</li>}
                  </ul>
                  {evs.length > 0 && (
                    <span className="mt-1 inline-flex gap-0.5 sm:hidden">
                      {evs.slice(0, 4).map((e) => (
                        <span key={`${e.type}-${e.id}`} className={cn('h-1.5 w-1.5 rounded-full', DOT[e.type])} />
                      ))}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-hairline px-4 py-2.5 text-[11.5px] text-slate-500">
            {TYPES.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm border-s-2', TONE[t])} /> {m.legend[t]}
              </span>
            ))}
          </div>
        </section>

        <PremiumPanel title={dayName} sub={m.summary(tally(selectedEvents))}>
          {selectedEvents.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">{m.dayEmpty}</p>
          ) : (
            <ul className="space-y-2" data-testid="calendar-day-list">
              {selectedEvents.map((e) => {
                const Icon =
                  e.type === 'visit'
                    ? MapPin
                    : e.type === 'done'
                      ? CalendarCheck2
                      : e.type === 'reservation_expiry'
                        ? Hourglass
                        : e.type === 'contract_signed'
                          ? FileSignature
                          : KIND_ICON[e.kind as keyof typeof KIND_ICON] ?? CalendarClock;
                return (
                  <li key={`${e.type}-${e.id}`}>
                    <Link href={href(e)} data-testid="calendar-event" className={cn('flex gap-3 rounded-xl border-s-[3px] px-3 py-2.5 transition-opacity hover:opacity-85', tone(e))}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-bold">{e.customer ?? '—'}</span>
                          <span className="shrink-0 tabular-nums text-[12px] font-semibold">{timeOf.format(new Date(e.at))}</span>
                        </p>
                        <p className="truncate text-[11.5px] opacity-80">
                          {label(e)}
                          {(e.type === 'reservation_expiry' || e.type === 'contract_signed') && e.ref && <> · <span dir="ltr">{e.ref}</span></>}
                          {(e.type === 'reservation_expiry' || e.type === 'contract_signed') && e.unit && <> · {m.unit} {e.unit}</>}
                          {e.type === 'visit' && <> · {m.visitStatus[e.status] ?? e.status}</>}
                          {e.type !== 'done' && e.project && <> · {tx(e.project, locale)}</>}
                          {e.sales && <> · {e.sales.fullName}</>}
                        </p>
                        {e.type === 'follow_up' && e.note && <p className="mt-0.5 line-clamp-1 text-[11.5px] opacity-80">{e.note}</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PremiumPanel>
      </div>
    </div>
  );
}
