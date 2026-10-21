import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Building blocks of the sales and manager homes, a day planner: a quiet
 * header with the day and the month's target, one row of figures, the week's
 * agenda around the selected day, and the day's tasks. Hairlines and one gold
 * accent; no data dumps.
 */

const GOLD = 'text-[#B8913F] dark:text-[#D8B66A]';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (!parts.length) return '؟';
  // Skip the Arabic article: "رامي الشريف" reads رش.
  const lead = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.charAt(2) : w.charAt(0));
  if (parts.length === 1) return lead(parts[0]!).toUpperCase();
  return (lead(parts[0]!) + lead(parts[parts.length - 1]!)).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 text-[12px] font-bold text-brand-700 ring-1 ring-brand-500/30',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

export function DayHeader({
  kicker,
  title,
  date,
  actions,
  target,
}: {
  /** The greeting. */
  kicker: string;
  /** Today's weekday. */
  title: string;
  /** Full date · desk name. */
  date: string;
  actions: ReactNode;
  /** The month's target, as a slim line under the date. */
  target: { label: string; pct: number | null; detail: string; note: string };
}) {
  const p = Math.max(0, Math.min(100, target.pct ?? 0));
  return (
    <header data-testid="day-header" className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 space-y-2">
        <p className={cn('text-[13px] font-bold tracking-wide', GOLD)}>{kicker}</p>
        <h1 className="font-heading text-[40px] font-bold leading-[1.1] text-slate-900 sm:text-[46px]">{title}</h1>
        <p className="text-[14px] text-slate-500">{date}</p>
        <div className="max-w-md pt-3">
          <div className="flex items-baseline justify-between gap-4 text-[12.5px]">
            <span className="font-semibold text-slate-600">
              {target.label}
              <span className="ms-2 font-bold tabular-nums text-slate-900">{target.pct === null ? '—' : `${Math.round(target.pct)}%`}</span>
            </span>
            <span className="text-slate-500">{target.note}</span>
          </div>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-slate-500/15">
            <div className="h-full rounded-full bg-gradient-to-l from-[#E6C77E] to-[#B8913F]" style={{ width: `${p}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] tabular-nums text-slate-500">{target.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}

/** A header action: gold for the main one, a hairline outline for the rest. */
export function DayAction({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors [&_svg]:h-4 [&_svg]:w-4',
        primary
          ? 'bg-gradient-to-l from-[#E6C77E] to-[#C9A24E] text-[#1a1408] shadow-[0_8px_20px_-10px_rgb(184_145_63/0.7)] hover:brightness-105'
          : 'border border-hairline bg-surface text-slate-700 hover:border-[#C9A24E]/60 hover:text-slate-900',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ── Figures ───────────────────────────────────────────────────────────────────

export interface Figure {
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
  warn?: boolean;
}

/** One quiet row of figures, hairlines between them. */
export function FigureBar({ figures, cols = 6, bare }: { figures: Figure[]; cols?: 4 | 5 | 6; bare?: boolean }) {
  return (
    <dl
      data-testid="figure-bar"
      className={cn(
        'grid grid-cols-2 overflow-hidden',
        !bare && 'rounded-[22px] border border-hairline bg-surface',
        cols === 6 ? 'sm:grid-cols-3 xl:grid-cols-6' : cols === 5 ? 'sm:grid-cols-3 xl:grid-cols-5' : 'xl:grid-cols-4',
      )}
    >
      {figures.map((f) => {
        const body = (
          <>
            <dt className="text-[12px] font-semibold text-slate-500">{f.label}</dt>
            <dd className="mt-2 whitespace-nowrap text-[26px] font-bold leading-none tabular-nums text-slate-900">{f.value}</dd>
            {f.sub && <dd className={cn('mt-2 truncate text-[11.5px]', f.warn ? 'font-semibold text-amber-600' : 'text-slate-500')}>{f.sub}</dd>}
          </>
        );
        const cls = 'block border-hairline px-5 py-5 xl:[&:not(:last-child)]:border-e max-xl:border-b';
        return f.href ? (
          <Link key={f.label} href={f.href as never} data-testid="figure" className={cn(cls, 'transition-colors hover:bg-surface-muted/40')}>
            {body}
          </Link>
        ) : (
          <div key={f.label} data-testid="figure" className={cls}>{body}</div>
        );
      })}
    </dl>
  );
}

/** A compact amount: the figure, its unit (ألف / مليون + currency) smaller beside it. */
export function Amount({ parts }: { parts: [string, string] | string[] }) {
  return (
    <>
      {parts[0]}
      {parts[1] && <span className="ms-1.5 text-[13px] font-semibold text-slate-500">{parts[1]}</span>}
    </>
  );
}

/**
 * A slim progress line to 100%, with a tick where an even pace would be by
 * today (`expected`), coloured by the target's status.
 */
export function PaceBar({ pct, expected, tone, className }: { pct: number | null; expected?: number | null; tone: string; className?: string }) {
  return (
    <div className={cn('relative h-1.5 rounded-full bg-slate-500/15', className)}>
      <span className={cn('absolute inset-y-0 start-0 rounded-full', tone)} style={{ width: `${Math.min(Math.max(pct ?? 0, 0), 100)}%` }} />
      {expected !== null && expected !== undefined && expected > 0 && expected < 100 && (
        <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-slate-900/60" style={{ insetInlineStart: `calc(${expected}% - 1px)` }} />
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function Panel({
  title,
  sub,
  link,
  children,
  className,
  testId,
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={cn('flex flex-col rounded-[22px] border border-hairline bg-surface', className)}>
      <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
        </div>
        {link && (
          <Link href={link.href as never} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-brand-700 hover:text-brand-600">
            {link.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ── Week agenda ───────────────────────────────────────────────────────────────

export interface DayEvent {
  id: string;
  href: string;
  time: string;
  title: string;
  sub: string;
  tag: 'visit' | 'expiry';
}

export interface AgendaDay {
  /** YYYY-MM-DD in the company's zone. */
  key: string;
  weekday: string;
  dayNum: string;
  events: DayEvent[];
}

/** Seven days as a strip; each one opens that day (`?day=`). */
export function DayStrip({ days, selected, countLabel }: { days: AgendaDay[]; selected: string; countLabel: (n: number) => string }) {
  return (
    <nav data-testid="day-strip" className="grid grid-cols-7 gap-1.5 px-4 sm:gap-2 sm:px-6">
      {days.map((d, i) => {
        const on = d.key === selected;
        const n = d.events.length;
        return (
          <Link
            key={d.key}
            href={(i === 0 ? '/dashboard' : `/dashboard?day=${d.key}`) as never}
            scroll={false}
            aria-current={on ? 'date' : undefined}
            title={countLabel(n)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center transition-colors',
              on
                ? 'border-[#C9A24E]/60 bg-[#D8B66A]/[0.12]'
                : 'border-transparent hover:border-hairline hover:bg-surface-muted/40',
            )}
          >
            <span className={cn('text-[11.5px] font-semibold', on ? GOLD : 'text-slate-500')}>{d.weekday}</span>
            <span className={cn('text-[22px] font-bold leading-none tabular-nums', on ? 'text-slate-900' : 'text-slate-700')}>{d.dayNum}</span>
            <span className="flex h-2 items-center gap-0.5" aria-hidden>
              {Array.from({ length: Math.min(n, 3) }).map((_, j) => (
                <span key={j} className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-[#B8913F]' : 'bg-slate-400/60')} />
              ))}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const TAG = {
  visit: 'bg-sky-500/12 text-sky-600',
  expiry: 'bg-amber-500/12 text-amber-600',
} as const;

/** The selected day hour by hour: time, a gold rail, the item and its tag. */
export function Timeline({
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
      <div data-testid="timeline-empty" className="mx-6 mb-6 mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline px-4 py-9 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#D8B66A]/[0.14]">
          <CalendarCheck2 className={cn('h-5 w-5', GOLD)} />
        </span>
        <p className="text-[14px] font-semibold text-slate-600">{empty.label}</p>
        {empty.next && (
          <Link href={empty.next.href as never} scroll={false} className="text-[13px] font-bold text-brand-700 hover:text-brand-600">
            {empty.next.label}
          </Link>
        )}
      </div>
    );
  }
  return (
    <ol data-testid="timeline" className="mt-4 px-6 pb-6">
      {events.map((e, i) => (
        <li key={e.id} className="grid grid-cols-[64px_20px_1fr] items-stretch">
          <span className="pt-4 text-[13px] font-bold tabular-nums text-slate-700" dir="ltr">{e.time}</span>
          <span className="relative flex justify-center" aria-hidden>
            <span className={cn('absolute inset-y-0 w-px bg-[#D8B66A]/35', i === 0 && 'top-5', i === events.length - 1 && 'bottom-auto h-5')} />
            <span className="relative mt-[18px] h-2.5 w-2.5 rounded-full bg-[#C9A24E] ring-4 ring-[#D8B66A]/20" />
          </span>
          <Link
            href={e.href as never}
            className="my-1 ms-2 flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-muted/50"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold text-slate-900" dir="auto">{e.title}</span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold', TAG[e.tag])}>{tags[e.tag]}</span>
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-slate-500">{e.sub}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 rtl:-scale-x-100" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface Task {
  key: string;
  icon: ReactNode;
  tone: 'amber' | 'sky' | 'rose' | 'violet';
  label: string;
  desc: string;
  count: number;
  href?: string;
}

const TASK_TONE = {
  amber:  'bg-amber-500/12 text-amber-600',
  sky:    'bg-sky-500/12 text-sky-600',
  rose:   'bg-rose-500/12 text-rose-500',
  violet: 'bg-violet-500/12 text-violet-600',
} as const;

/** What needs doing today; only the tasks with something in them. */
export function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  const open = tasks.filter((t) => t.count > 0);
  if (open.length === 0) {
    return (
      <div className="mx-6 mb-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        <p className="text-[13px] text-slate-500">{empty}</p>
      </div>
    );
  }
  return (
    <ul data-testid="tasks" className="divide-y divide-hairline border-t border-hairline">
      {open.map((t) => {
        const body = (
          <>
            <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]', TASK_TONE[t.tone])}>
              {t.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-slate-900">{t.label}</span>
              <span className="block truncate text-[12px] text-slate-500">{t.desc}</span>
            </span>
            <span className="text-[22px] font-bold tabular-nums text-slate-900">{t.count}</span>
          </>
        );
        return (
          <li key={t.key}>
            {t.href ? (
              <Link href={t.href as never} className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-surface-muted/40">{body}</Link>
            ) : (
              <div className="flex items-center gap-3 px-6 py-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Open leads by stage ───────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  { stage: 'NEW',         bar: 'bg-slate-400'  },
  { stage: 'INTERESTED',  bar: 'bg-sky-400'    },
  { stage: 'VISIT',       bar: 'bg-violet-400' },
  { stage: 'NEGOTIATION', bar: 'bg-[#C9A24E]'  },
] as const;

/** One stacked bar and the four counts; each stage opens its list. */
export function PipelineSplit({ stages }: { stages: Array<{ stage: string; label: string; count: number }> }) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  return (
    <div data-testid="pipeline" className="px-6 pb-6">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
        {total > 0 &&
          stages.filter((s) => s.count > 0).map((s) => (
            <div
              key={s.stage}
              className={cn('h-full', PIPELINE_STAGES.find((p) => p.stage === s.stage)?.bar)}
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {stages.map((s) => (
          <li key={s.stage}>
            <Link
              href={`/dashboard/leads?stage=${s.stage}` as never}
              className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-muted/50"
            >
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600">
                <span className={cn('h-2 w-2 rounded-full', PIPELINE_STAGES.find((p) => p.stage === s.stage)?.bar)} />
                {s.label}
              </span>
              <span className="text-[16px] font-bold tabular-nums text-slate-900">{s.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────

export interface TeamRow {
  id: string;
  name: string;
  pct: number | null;
  contracts: string;
  realized: string;
  inactive?: string;
}

/** The team in one line each: name, a thin bar to target, the month's figures. */
export function TeamList({ rows, empty }: { rows: TeamRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{empty}</p>;
  }
  return (
    <ol data-testid="team" className="divide-y divide-hairline border-t border-hairline">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-4 px-6 py-3.5">
          <span className={cn('w-5 shrink-0 text-center text-[13px] font-bold tabular-nums', i === 0 && !r.inactive ? GOLD : 'text-slate-400')}>{i + 1}</span>
          <Avatar name={r.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
              <p className="truncate text-[14px] font-bold text-slate-900" dir="auto">{r.name}</p>
              {r.inactive && <span className="shrink-0 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">{r.inactive}</span>}
            </div>
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-slate-500/15">
              <div
                className={cn('h-full rounded-full', r.pct !== null && r.pct >= 100 ? 'bg-emerald-400' : 'bg-gradient-to-l from-[#E6C77E] to-[#B8913F]')}
                style={{ width: `${Math.min(100, r.pct ?? 0)}%` }}
              />
            </div>
          </div>
          <span className="w-12 shrink-0 text-end text-[14px] font-bold tabular-nums text-slate-900">{r.pct === null ? '—' : `${Math.round(r.pct)}%`}</span>
          <span className="hidden w-20 shrink-0 text-end text-[12px] text-slate-500 sm:block">{r.contracts}</span>
          <span className="w-28 shrink-0 whitespace-nowrap text-end text-[13px] font-bold tabular-nums text-brand-700">{r.realized}</span>
        </li>
      ))}
    </ol>
  );
}
