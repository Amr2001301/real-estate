import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AgendaDay, DayEvent, Figure, Task, TeamRow } from '@/components/cockpit/cockpit';
import { PIPELINE_STAGES } from '@/components/cockpit/cockpit';
import { Avatar, Ring } from './admin-home';

/**
 * The sales, manager and brokerage homes in the Devora look: the day over a
 * photo with the month's target on glass, one white bar of figures, the week's
 * agenda beside the day's tasks and the open leads, and (manager) the team.
 * Same props and test ids as the cockpit blocks they replace on these homes;
 * other pages keep the cockpit ones.
 */

const GOLD_BG = 'bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)]';

// ── Header ────────────────────────────────────────────────────────────────────

export function DayHero({
  kicker,
  title,
  date,
  actions,
  target,
  image = '/images/dashboard-hero.jpg',
}: {
  kicker: string;
  title: string;
  date: string;
  actions: ReactNode;
  target?: { label: string; pct: number | null; detail: string; note: string };
  image?: string;
}) {
  return (
    <header
      data-testid="day-header"
      className="relative flex min-h-[270px] flex-col justify-between gap-6 overflow-hidden rounded-[30px] bg-[#0B1220] p-6 shadow-[0_30px_60px_-30px_rgb(11_18_32/0.45)] sm:p-8 dark:shadow-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[center_55%]" />
      <div
        aria-hidden
        className="absolute inset-0 rtl:bg-[linear-gradient(270deg,rgba(11,18,32,0.95)_0%,rgba(11,18,32,0.75)_45%,rgba(11,18,32,0.3)_100%)] ltr:bg-[linear-gradient(90deg,rgba(11,18,32,0.95)_0%,rgba(11,18,32,0.75)_45%,rgba(11,18,32,0.3)_100%)]"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="text-[#F7F3EA]">
          <p className="inline-flex items-center gap-2.5 text-[12px] font-semibold tracking-[0.06em] text-[#E2C792]">
            <span aria-hidden className="h-[1.5px] w-[22px] bg-current opacity-70" />
            {kicker}
          </p>
          <h1 className="font-heading mt-2.5 text-[38px] font-semibold leading-tight text-[#F7F3EA] sm:text-[42px]">{title}</h1>
          <p className="mt-1 text-[14px] text-[#F7F3EA]/75">{date}</p>
        </div>
        {target && (
          <div className="flex items-center gap-4 rounded-[20px] border border-white/[0.14] bg-[#0B1220]/45 px-5 py-4 backdrop-blur-xl">
            {target.pct !== null && <Ring pct={Math.round(target.pct)} size={76} stroke={7} light />}
            <div className="text-[#F7F3EA]">
              <p className="text-[12px] font-semibold text-[#E2C792]">
                {target.label}
                {target.pct === null && <span className="ms-2 text-[#F7F3EA]/70">—</span>}
              </p>
              <p className="num mt-1 text-[15px] font-semibold">{target.detail}</p>
              <p className="mt-0.5 text-[12px] text-[#F7F3EA]/70">{target.note}</p>
            </div>
          </div>
        )}
      </div>
      <div className="relative flex flex-wrap items-center gap-2.5 max-sm:[&>*]:grow max-sm:[&>*]:justify-center">{actions}</div>
    </header>
  );
}

/** A hero action: gold for the main one, glass for the rest. */
export function DayHeroAction({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full px-[18px] text-[13px] font-semibold transition [&_svg]:h-4 [&_svg]:w-4',
        primary
          ? cn(GOLD_BG, 'text-[#0B1220] shadow-[0_10px_24px_rgb(200_162_75/0.28)] hover:brightness-105')
          : 'border border-white/25 bg-white/10 text-[#F7F3EA] backdrop-blur-md hover:bg-white/15',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ── Figures ───────────────────────────────────────────────────────────────────

/** One white bar, hairlines between the figures; a warning shows as an amber dot and line. */
export function FigureCards({ figures }: { figures: Figure[] }) {
  return (
    <dl
      data-testid="figure-bar"
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-[22px] border border-hairline bg-surface py-1 sm:grid-cols-3',
        'shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08)] dark:shadow-none',
        figures.length >= 6 ? 'xl:grid-cols-6' : figures.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4',
      )}
    >
      {figures.map((f, i) => {
        const body = (
          <>
            <dt className="text-[13px] text-slate-600">{f.label}</dt>
            <dd className="num whitespace-nowrap text-[28px] font-semibold leading-none tracking-[-0.02em] text-slate-900 [&_.text-slate-500]:!text-[13px]">{f.value}</dd>
            {f.sub && (
              <dd className={cn('flex items-center gap-1.5 truncate text-[12px]', f.warn ? 'font-semibold text-[#94650A] dark:text-[#E9B44C]' : 'text-slate-500')}>
                {f.warn && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8961F]" />}
                {f.sub}
              </dd>
            )}
          </>
        );
        const cls = cn('flex min-w-0 flex-col gap-2 px-[22px] py-5', i > 0 && 'xl:border-s xl:border-hairline');
        return f.href ? (
          <Link key={f.label} href={f.href as never} data-testid="figure" className={cn(cls, 'transition-colors hover:bg-surface-muted/60')}>
            {body}
          </Link>
        ) : (
          <div key={f.label} data-testid="figure" className={cls}>{body}</div>
        );
      })}
    </dl>
  );
}

// ── Agenda ────────────────────────────────────────────────────────────────────

/** Seven day cards; today is navy (gold in dark mode), the others hairline. */
export function DayStripV2({ days, selected, countLabel }: { days: AgendaDay[]; selected: string; countLabel: (n: number) => string }) {
  return (
    <nav data-testid="day-strip" className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((d, i) => {
        const on = d.key === selected;
        return (
          <Link
            key={d.key}
            href={(i === 0 ? '/dashboard' : `/dashboard?day=${d.key}`) as never}
            scroll={false}
            aria-current={on ? 'date' : undefined}
            title={countLabel(d.events.length)}
            className={cn(
              'flex min-w-0 flex-col items-center rounded-2xl px-1 py-3 text-center transition-colors',
              on
                ? 'bg-[#0B1220] text-[#F7F3EA] dark:bg-[#C8A24B] dark:text-[#0B1220]'
                : 'border border-hairline bg-surface-muted text-slate-900 hover:border-[#C8A24B]/50',
            )}
          >
            <span className="truncate text-[12px] opacity-80">{d.weekday}</span>
            <span className="num my-1 text-[22px] font-semibold leading-none">{d.dayNum}</span>
            <span className="hidden truncate text-[11px] opacity-75 sm:block">{countLabel(d.events.length)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

const TAG = {
  visit: { dot: 'bg-[#2A539C] dark:bg-[#7FA6E8]', ring: 'shadow-[0_0_0_5px_rgb(42_83_156/0.10)]', pill: 'bg-[#2A539C]/10 text-[#2A539C] dark:text-[#7FA6E8]' },
  expiry: { dot: 'bg-danger-600', ring: 'shadow-[0_0_0_5px_rgb(181_52_52/0.10)]', pill: 'bg-danger-600/10 text-danger-700 dark:text-[#F06A6A]' },
} as const;

/** The selected day: time, a dot on a rail, and the item as a card. */
export function TimelineV2({
  events,
  tags,
  empty,
}: {
  events: DayEvent[];
  tags: Record<DayEvent['tag'], string>;
  empty: { label: string; next?: { href: string; label: string } };
}) {
  if (events.length === 0) {
    return (
      <div data-testid="timeline-empty" className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline px-4 py-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#C8A24B]/[0.14]">
          <CalendarCheck2 className="h-5 w-5 text-[#8A6823] dark:text-[#E2C792]" />
        </span>
        <p className="text-[14px] font-semibold text-slate-600">{empty.label}</p>
        {empty.next && (
          <Link href={empty.next.href as never} scroll={false} className="text-[13px] font-semibold text-[#8A6823] hover:text-[#C8A24B] dark:text-[#E2C792]">
            {empty.next.label}
          </Link>
        )}
      </div>
    );
  }
  return (
    <ol data-testid="timeline" className="flex-1">
      {events.map((e, i) => (
        <li key={e.id} className="grid grid-cols-[54px_20px_minmax(0,1fr)] gap-x-3">
          <span className="num pt-[15px] text-end text-[14px] font-semibold text-slate-900" dir="ltr">{e.time}</span>
          <span className="relative flex justify-center" aria-hidden>
            {i < events.length - 1 && <span className="absolute bottom-0 top-[26px] w-0.5 bg-hairline" />}
            <span className={cn('relative mt-[18px] h-3 w-3 rounded-full', TAG[e.tag].dot, TAG[e.tag].ring)} />
          </span>
          <Link
            href={e.href as never}
            className="mb-3 flex items-center gap-3 rounded-2xl border border-hairline bg-surface-muted px-4 py-3.5 transition-colors hover:border-[#C8A24B]/50"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold', TAG[e.tag].pill)}>
                  <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', TAG[e.tag].dot)} />
                  {tags[e.tag]}
                </span>
                <span className="truncate text-[14px] font-semibold text-slate-900" dir="auto">{e.title}</span>
              </span>
              <span className="mt-1.5 block truncate text-[12px] text-slate-500">{e.sub}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 rtl:-scale-x-100" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

const TASK_TONE = {
  amber: 'bg-amber-500/12 text-[#94650A] dark:text-[#E9B44C]',
  sky: 'bg-[#2A539C]/10 text-[#2A539C] dark:text-[#7FA6E8]',
  rose: 'bg-danger-600/10 text-danger-700 dark:text-[#F06A6A]',
  violet: 'bg-[#C8A24B]/14 text-[#8A6823] dark:text-[#E2C792]',
} as const;

/** The day's tasks as rows with a count pill; only those with something in them. */
export function TasksV2({ tasks, empty }: { tasks: Task[]; empty: string }) {
  const open = tasks.filter((t) => t.count > 0);
  if (open.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        <p className="text-[13px] text-slate-500">{empty}</p>
      </div>
    );
  }
  return (
    <ul data-testid="tasks" className="-my-1">
      {open.map((t, i) => {
        const body = (
          <>
            <span className={cn('inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px]', TASK_TONE[t.tone])}>
              {t.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-slate-900">{t.label}</span>
              {t.desc && <span className="mt-0.5 block truncate text-[12px] text-slate-500">{t.desc}</span>}
            </span>
            <span className={cn('num inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-2 text-[14px] font-semibold', TASK_TONE[t.tone])}>{t.count}</span>
          </>
        );
        const cls = cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-hairline');
        return (
          <li key={t.key}>
            {t.href ? <Link href={t.href as never} className={cn(cls, 'transition-colors hover:bg-surface-muted/50')}>{body}</Link> : <div className={cls}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// ── Open leads by stage ───────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  NEW: 'bg-[#C8A24B]',
  INTERESTED: 'bg-[#22355A] dark:bg-[#7FA6E8]',
  VISIT: 'bg-[#C8961F]',
  NEGOTIATION: 'bg-[#17784A] dark:bg-[#4CC38A]',
};

/** One stacked bar and the four stages as tiles; each opens its list. */
export function PipelineV2({ stages }: { stages: Array<{ stage: string; label: string; count: number }> }) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  const order = PIPELINE_STAGES.map((p) => p.stage) as readonly string[];
  const sorted = [...stages].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return (
    <div data-testid="pipeline" className="flex flex-col gap-4">
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-surface-sunken">
        {total > 0 &&
          sorted.filter((s) => s.count > 0).map((s) => (
            <span key={s.stage} className={STAGE_COLOR[s.stage]} style={{ width: `${(s.count / total) * 100}%` }} />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {sorted.map((s) => (
          <li key={s.stage}>
            <Link
              href={`/dashboard/leads?stage=${s.stage}` as never}
              className="block rounded-[14px] border border-hairline bg-surface-muted p-3 transition-colors hover:border-[#C8A24B]/50"
            >
              <span className="flex items-center gap-1.5 text-[12px] text-slate-600">
                <span className={cn('h-2 w-2 rounded-sm', STAGE_COLOR[s.stage])} aria-hidden />
                {s.label}
              </span>
              <span className="num mt-1 block text-[22px] font-semibold text-slate-900">{s.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────

/** The team ranked: avatar and name, a gold bar to target, contracts and the amount realised. */
export function TeamV2({ rows, empty, noTarget }: { rows: TeamRow[]; empty: string; noTarget: string }) {
  if (rows.length === 0) {
    return <p className="rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{empty}</p>;
  }
  return (
    <ol data-testid="team" className="-my-1">
      {rows.map((r, i) => (
        <li
          key={r.id}
          className={cn(
            'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3.5 md:grid-cols-[28px_minmax(0,1.4fr)_minmax(0,2fr)_100px_120px]',
            i > 0 && 'border-t border-hairline',
          )}
        >
          <span className={cn('num text-[14px] font-semibold', i === 0 && !r.inactive ? 'text-[#C8A24B]' : 'text-slate-500')}>{i + 1}</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={r.name} i={i} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold text-slate-900" dir="auto">{r.name}</span>
              {r.inactive && (
                <span className="mt-0.5 inline-flex h-5 items-center gap-1 rounded-lg bg-danger-600/10 px-2 text-[11px] font-semibold text-danger-700 dark:text-[#F06A6A]">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  {r.inactive}
                </span>
              )}
            </span>
          </span>
          <span className="col-span-3 flex items-center gap-3 md:col-span-1 max-md:order-last">
            {r.pct !== null ? (
              <>
                <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span className={cn('h-full rounded-full', r.pct >= 100 ? 'bg-emerald-500' : GOLD_BG)} style={{ width: `${Math.min(100, r.pct)}%` }} />
                </span>
                <span className="num w-12 text-[14px] font-semibold text-slate-900">{Math.round(r.pct)}%</span>
              </>
            ) : (
              <span className="text-[12px] text-slate-500">{noTarget}</span>
            )}
          </span>
          <span className="hidden text-[13px] text-slate-600 md:block">{r.contracts}</span>
          <span className="num whitespace-nowrap text-end text-[14px] font-semibold text-slate-900">{r.realized}</span>
        </li>
      ))}
    </ol>
  );
}
