import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  Bookmark,
  CalendarCheck2,
  FileText,
  MessageSquare,
  Receipt,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { compactParts, shareText, sharesOf } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import type { ActionItem, ActivityItem, FunnelStage, LeaderRow } from './admin-panels';

/**
 * The redesigned admin home (the "Devora" premium look): a photo hero with the
 * money figures on glass, then panels that keep their columns the same height
 * so no empty gaps are left between them. Plain numbers and labels in; no data
 * fetching here. Scoped by the `.dash-v2` wrapper on the page (fonts).
 */

type Money = { symbol: string; locale: Locale };

const GOLD = 'bg-[linear-gradient(135deg,#EAD5A3_0%,#C8A24B_48%,#9E7A2B_100%)]';
const NAVY_BAR = 'bg-[linear-gradient(270deg,#22355A,#0B1220)] dark:bg-none dark:bg-[#C8A24B]/50';

function Amount({ value, money, className, unitClassName }: { value: number; money: Money; className?: string; unitClassName?: string }) {
  const [num, unit] = compactParts(value, money.symbol, money.locale);
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span dir="ltr" className={cn('num font-semibold tracking-[-0.02em] text-slate-900', className)}>{num}</span>
      {unit && <span className={cn('text-[12px] text-slate-500', unitClassName)}>{unit}</span>}
    </span>
  );
}

/** A white card with an El Messiri title, an optional line under it and a gold link. */
export function Panel({
  title,
  sub,
  link,
  trailing,
  children,
  className,
  bodyClassName,
  testId,
}: {
  title: string;
  sub?: ReactNode;
  link?: { href: string; label: string };
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className={cn(
        'flex min-w-0 flex-col gap-[18px] rounded-[22px] border border-hairline bg-surface p-6',
        'shadow-[0_1px_2px_rgb(11_18_32/0.04),0_10px_30px_-10px_rgb(11_18_32/0.08),0_30px_60px_-30px_rgb(11_18_32/0.12)] dark:shadow-none',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[19px] font-semibold leading-snug text-slate-900">{title}</h2>
          {sub && <p className="mt-1 text-[12.5px] text-slate-500">{sub}</p>}
        </div>
        {trailing}
        {link && (
          <Link
            href={link.href as never}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-[#8A6823] hover:text-[#C8A24B] dark:text-[#E2C792]"
          >
            {link.label}
            <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" strokeWidth={2} aria-hidden />
          </Link>
        )}
      </header>
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
    </section>
  );
}

/** A progress ring; the figure sits in the middle. */
export function Ring({ pct, size = 66, stroke = 6, light = false, label }: { pct: number; size?: number; stroke?: number; light?: boolean; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={light ? 'stroke-white/15' : 'stroke-surface-sunken'} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          className={light ? 'stroke-[#E2C792]' : 'stroke-[#C8A24B]'}
        />
      </svg>
      <span
        className={cn('num absolute inset-0 flex items-center justify-center font-semibold', light ? 'text-[#F7F3EA]' : 'text-slate-900')}
        style={{ fontSize: Math.round(size * 0.24) }}
      >
        {label ?? `${p}%`}
      </span>
    </span>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export interface HeroMetric {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  /** A short status under the figure, as a coloured chip. */
  trend?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  /** 0–100: a thin bar under the figure (a share or a rate). */
  bar?: number;
  /** A caption beside the bar, when there is no chip. */
  barLabel?: string;
}

const TREND: Record<NonNullable<HeroMetric['tone']>, string> = {
  success: 'bg-[#7DD3A8]/[0.12] text-[#7DD3A8]',
  warning: 'bg-[#F1CB7A]/[0.12] text-[#F1CB7A]',
  danger: 'bg-[#F5A3A3]/[0.12] text-[#F5A3A3]',
  neutral: 'bg-white/[0.08] text-[#F7F3EA]/75',
};

const BAR: Record<NonNullable<HeroMetric['tone']>, string> = {
  success: 'bg-[#7DD3A8]',
  warning: 'bg-[#F1CB7A]',
  danger: 'bg-[#F5A3A3]',
  neutral: 'bg-[linear-gradient(90deg,#EAD5A3,#C8A24B)]',
};

/** The greeting over a photo, the actions, and the money figures on a glass strip. */
export function HeroV2({
  eyebrow,
  title,
  description,
  actions,
  image,
  metrics,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  image: string;
  metrics: HeroMetric[];
}) {
  return (
    <section
      data-testid="dashboard-hero"
      className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[30px] bg-[#0B1220] shadow-[0_30px_60px_-30px_rgb(11_18_32/0.45)] dark:shadow-none"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[center_60%]" />
      <div
        aria-hidden
        className="absolute inset-0 rtl:bg-[linear-gradient(270deg,rgba(11,18,32,0.95)_0%,rgba(11,18,32,0.78)_50%,rgba(11,18,32,0.35)_100%)] ltr:bg-[linear-gradient(90deg,rgba(11,18,32,0.95)_0%,rgba(11,18,32,0.78)_50%,rgba(11,18,32,0.35)_100%)]"
      />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,18,32,0.92)_0%,rgba(11,18,32,0)_55%)]" />

      <div className="relative flex flex-wrap items-start justify-between gap-5 px-6 pt-8 sm:px-9">
        <div className="max-w-[620px] text-[#F7F3EA]">
          <p className="inline-flex items-center gap-2.5 text-[12px] font-semibold tracking-[0.06em] text-[#E2C792]">
            <span aria-hidden className="h-[1.5px] w-[22px] bg-current opacity-70" />
            {eyebrow}
          </p>
          <h1 className="font-heading mt-2.5 text-[34px] font-semibold leading-tight text-[#F7F3EA] sm:text-[40px]">{title}</h1>
          <p className="mt-2 text-[15px] text-[#F7F3EA]/75">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      </div>
      <div className="flex-1" />

      <div
        data-testid="metric-strip"
        className="relative m-4 mt-7 grid grid-cols-2 gap-y-5 rounded-[22px] border border-white/[0.12] bg-[#0B1220]/45 py-5 backdrop-blur-xl sm:m-[18px] lg:grid-cols-5"
      >
        {/* Every figure has the same four rows — label, figure, one line, a
            bar or chip — so the columns line up with nothing empty under them. */}
        {metrics.map((m, i) => (
          <div key={i} data-testid="hero-metric" className={cn('flex min-w-0 flex-col px-6', i > 0 && 'lg:border-s lg:border-white/[0.12]')}>
            <p className="truncate text-[13px] text-[#F7F3EA]/75">{m.label}</p>
            <p className="mt-2.5 flex items-baseline gap-1.5">
              <span dir="ltr" className="num text-[30px] font-semibold leading-none tracking-[-0.03em] text-[#F7F3EA]">
                {m.value}
                {m.unit === '%' && <span className="text-[18px] text-[#F7F3EA]/80">%</span>}
              </span>
              {m.unit && m.unit !== '%' && <span className="text-[13px] text-[#F7F3EA]/70">{m.unit}</span>}
            </p>
            {m.sub && <p className="mt-1.5 truncate text-[12px] text-[#F7F3EA]/70">{m.sub}</p>}
            {(m.bar !== undefined || m.trend) && (
              <div className="mt-auto flex min-h-[24px] items-center gap-2.5 pt-3.5">
                {m.bar !== undefined && (
                  <span aria-hidden className="h-[5px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                    <span className={cn('block h-full rounded-full', BAR[m.tone ?? 'neutral'])} style={{ width: `${Math.max(0, Math.min(100, m.bar))}%` }} />
                  </span>
                )}
                {m.barLabel && !m.trend && <span className="whitespace-nowrap text-[11.5px] text-[#F7F3EA]/70">{m.barLabel}</span>}
                {m.trend && (
                  <span data-testid="hero-metric-chip" className={cn('whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold', TREND[m.tone ?? 'success'])}>
                    {m.trend}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** A glass button for the hero (the gold one is the page's main action). */
export function HeroAction({ href, icon, children, gold }: { href: string; icon?: ReactNode; children: ReactNode; gold?: boolean }) {
  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full px-[18px] text-[13px] font-semibold transition [&_svg]:h-4 [&_svg]:w-4',
        gold
          ? cn(GOLD, 'text-[#0B1220] shadow-[0_10px_24px_rgb(200_162_75/0.28)] hover:brightness-105')
          : 'border border-white/25 bg-white/10 text-[#F7F3EA] backdrop-blur-md hover:bg-white/15',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ── Needs action ─────────────────────────────────────────────────────────────

const ACTION_ICON: Record<ActionItem['icon'], ReactNode> = {
  contracts: <FileText />,
  maintenance: <Wrench />,
  visits: <CalendarCheck2 />,
  requests: <MessageSquare />,
  payments: <Receipt />,
};

const ACTION_TONE: Record<ActionItem['icon'], string> = {
  payments: 'bg-amber-500/12 text-[#94650A] dark:text-[#E9B44C]',
  contracts: 'bg-[#C8A24B]/14 text-[#8A6823] dark:text-[#E2C792]',
  maintenance: 'bg-danger-600/10 text-danger-700 dark:text-[#F06A6A]',
  visits: 'bg-[#2A539C]/10 text-[#2A539C] dark:text-[#7FA6E8]',
  requests: 'bg-success-600/10 text-success-700 dark:text-[#4CC38A]',
};

export function ActionTiles({ title, allClear, items }: { title: string; allClear: string; items: ActionItem[] }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <Panel
      title={title}
      trailing={
        total === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden />
            {allClear}
          </span>
        ) : undefined
      }
    >
      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', items.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href as never}
            className={cn(
              'flex min-w-0 flex-col gap-3 rounded-[18px] border border-hairline p-[18px] transition-colors hover:border-[#C8A24B]/50',
              it.value > 0 ? 'bg-surface-muted' : 'bg-surface',
            )}
          >
            <span className="flex items-center justify-between">
              <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl [&_svg]:h-[19px] [&_svg]:w-[19px]', ACTION_TONE[it.icon])}>
                {ACTION_ICON[it.icon]}
              </span>
              <span className={cn('num text-[28px] font-semibold leading-none', it.value > 0 ? ACTION_TONE[it.icon].split(' ').slice(1).join(' ') : 'text-slate-400')}>
                {it.value}
              </span>
            </span>
            <span className="text-[13.5px] font-semibold leading-snug text-slate-900">{it.label}</span>
            {it.note && (
              <span className="-mt-1.5 text-[12px] font-semibold text-danger-600" data-testid={`action-note-${it.key}`}>
                {it.note}
              </span>
            )}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

// ── Recent activity ──────────────────────────────────────────────────────────

const ACTIVITY: Record<string, { icon: ReactNode; tone: string }> = {
  deposit: { icon: <Banknote />, tone: 'bg-success-600/10 text-success-700 dark:text-[#4CC38A]' },
  reservation: { icon: <Bookmark />, tone: 'bg-[#2A539C]/10 text-[#2A539C] dark:text-[#7FA6E8]' },
  lead: { icon: <UserPlus />, tone: 'bg-amber-500/12 text-[#94650A] dark:text-[#E9B44C]' },
  contract: { icon: <FileText />, tone: 'bg-[#C8A24B]/14 text-[#8A6823] dark:text-[#E2C792]' },
  visit: { icon: <CalendarCheck2 />, tone: 'bg-[#2A539C]/10 text-[#2A539C] dark:text-[#7FA6E8]' },
  maintenance: { icon: <Wrench />, tone: 'bg-danger-600/10 text-danger-700 dark:text-[#F06A6A]' },
  info_request: { icon: <MessageSquare />, tone: 'bg-success-600/10 text-success-700 dark:text-[#4CC38A]' },
};

export function ActivityPanelV2({
  title,
  sub,
  link,
  empty,
  items,
  money,
}: {
  title: string;
  sub: string;
  link: { href: string; label: string };
  empty: string;
  items: Array<ActivityItem & { count: number }>;
  money: Money;
}) {
  return (
    <Panel title={title} sub={sub} link={link}>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-500">{empty}</p>
      ) : (
        <ul className="-my-1">
          {items.map((it, i) => {
            const a = ACTIVITY[it.type] ?? ACTIVITY.contract!;
            const body = (
              <>
                <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px]', a.tone)}>{a.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">
                    <span className="font-semibold text-slate-900">{it.who}</span> <span className="text-slate-600">{it.action}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                    {it.ref && <><bdi className="num" dir="ltr">{it.ref}</bdi> · </>}
                    {it.when}
                  </span>
                </span>
                {it.amount !== undefined && it.amount > 0 && <Amount value={it.amount} money={money} className="text-[14px]" />}
              </>
            );
            return (
              <li key={it.id} className={cn(i > 0 && 'border-t border-hairline')}>
                {it.href ? (
                  <Link href={it.href as never} className="flex items-center gap-3.5 py-[13px] transition-colors hover:bg-surface-muted/60">{body}</Link>
                ) : (
                  <div className="flex items-center gap-3.5 py-[13px]">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// ── Monthly bookings ─────────────────────────────────────────────────────────

/** Bars that grow to fill their card; the latest month in gold. */
export function MonthlyBarsV2({ title, sub, empty, data }: { title: string; sub: string; empty: string; data: Array<{ label: string; value: number }> }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <Panel title={title} sub={sub} className="flex-1">
      {max === 0 ? (
        <p className="text-[13px] text-slate-500">{empty}</p>
      ) : (
        <div className="flex min-h-[230px] flex-1 items-end gap-4 pt-1.5">
          {data.map((d, i) => {
            const last = i === data.length - 1;
            return (
              <div key={`${d.label}-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={cn('num text-[12px] font-semibold', last ? 'text-slate-900' : 'text-slate-500')}>{d.value}</span>
                <div
                  className={cn(
                    'w-full max-w-[46px] rounded-t-[12px] rounded-b-[6px]',
                    last ? GOLD : 'bg-[linear-gradient(180deg,#1A2742,#0B1220)] dark:bg-none dark:bg-[#C8A24B]/30',
                  )}
                  style={{ height: `${Math.max(4, (d.value / max) * 78)}%` }}
                />
                <span className="text-[12px] text-slate-500">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

const AVATAR = [
  'bg-[linear-gradient(135deg,#1C3050,#0E1626)]',
  'bg-[linear-gradient(135deg,#C8A24B,#8A6A23)]',
  'bg-[linear-gradient(135deg,#3A4A6B,#26405F)]',
  'bg-[linear-gradient(135deg,#6B5A3A,#3A3020)]',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export function Avatar({ name, i, size = 38 }: { name: string; i: number; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn('font-heading inline-flex shrink-0 items-center justify-center rounded-full border border-[#E2C792]/25 font-semibold text-[#F4EFE4]', AVATAR[i % 4])}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}

export function LeaderboardV2({
  title,
  sub,
  link,
  empty,
  rows,
  money,
  className,
}: {
  title: string;
  sub: string;
  link: { href: string; label: string };
  empty: string;
  rows: LeaderRow[];
  money: Money;
  className?: string;
}) {
  const ranked = rows.filter((r) => r.value > 0);
  return (
    <Panel title={title} sub={sub} link={link} className={className}>
      {ranked.length === 0 ? (
        <p className="text-[13px] text-slate-500">{empty}</p>
      ) : (
        <ol className="-my-1">
          {ranked.map((r, i) => (
            <li key={r.id} className={cn('flex items-center gap-3 py-[11px]', i > 0 && 'border-t border-hairline')}>
              <span className={cn('num w-5 text-[13px] font-semibold', i === 0 ? 'text-[#C8A24B]' : 'text-slate-500')}>{i + 1}</span>
              <Avatar name={r.name} i={i} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-slate-900">{r.name}</span>
                <span className="block text-[12px] text-slate-500">{r.sub}</span>
              </span>
              <Amount value={r.value} money={money} className="text-[14px]" />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export function FunnelV2({ title, sub, stages, footnote }: { title: string; sub: string; stages: FunnelStage[]; footnote?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <Panel title={title} sub={sub}>
      <div className="flex flex-1 flex-col justify-center gap-4">
        {stages.map((s, i) => (
          <div key={s.label} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-600">{s.label}</span>
              <span className="num font-semibold text-slate-900">{s.value.toLocaleString('en')}</span>
            </div>
            <div className="flex h-3 rounded-md bg-surface-sunken">
              <div
                className={cn('h-full rounded-md', i === stages.length - 1 ? GOLD : NAVY_BAR)}
                style={{ width: `${s.value > 0 ? Math.max(4, (s.value / max) * 100) : 0}%` }}
              />
            </div>
            {s.note && <p className="text-[12px] font-semibold text-success-700 dark:text-[#4CC38A]">{s.note}</p>}
          </div>
        ))}
      </div>
      {footnote && <p className="mt-4 border-t border-hairline pt-3 text-[12px] leading-relaxed text-slate-500">{footnote}</p>}
    </Panel>
  );
}

// ── Project health ───────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  city?: string;
  cover?: string;
  sold: number;
  reserved: number;
  available: number;
  signed: number;
  value: number;
}

export function ProjectHealthV2({
  title,
  sub,
  link,
  projects,
  labels,
  money,
}: {
  title: string;
  sub: string;
  link: { href: string; label: string };
  projects: ProjectRow[];
  labels: { sold: string; reserved: string; available: string; signed: (n: number) => string };
  money: Money;
}) {
  return (
    <Panel title={title} sub={sub} link={link}>
      <ul className="-my-1">
        {projects.map((p, i) => {
          const total = p.sold + p.reserved + p.available || 1;
          return (
            <li key={p.id} className={cn(i > 0 && 'border-t border-hairline')}>
              <Link
                href={`/dashboard/projects/${p.id}` as never}
                className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-3.5 sm:grid-cols-[64px_minmax(0,1.3fr)_minmax(0,2fr)_auto] sm:gap-[18px]"
              >
                <span className="h-[50px] w-full overflow-hidden rounded-xl bg-[linear-gradient(135deg,#1A2742,#0B1220)]">
                  {p.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-slate-900">{p.name}</span>
                  {p.city && <span className="block truncate text-[12px] text-slate-500">{p.city}</span>}
                </span>
                <span className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                  <span className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${p.sold} ${labels.sold} · ${p.reserved} ${labels.reserved} · ${p.available} ${labels.available}`}>
                    <span className={GOLD} style={{ width: `${(p.sold / total) * 100}%` }} />
                    <span className="bg-[#22355A] dark:bg-[#E2C792]/45" style={{ width: `${(p.reserved / total) * 100}%` }} />
                  </span>
                  <span className="flex gap-3.5 text-[12px] text-slate-500">
                    <span><b className="num font-semibold text-slate-900">{p.sold}</b> {labels.sold}</span>
                    <span><b className="num font-semibold text-slate-900">{p.reserved}</b> {labels.reserved}</span>
                    <span><b className="num font-semibold text-slate-900">{p.available}</b> {labels.available}</span>
                  </span>
                </span>
                <span className="col-span-2 flex items-baseline justify-between gap-3 sm:col-span-1 sm:block sm:text-end">
                  <Amount value={p.value} money={money} className="text-[15px]" />
                  <span className="block text-[12px] text-slate-500">{labels.signed(p.signed)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ── Financial health ─────────────────────────────────────────────────────────

export function FinancialHealthV2({
  title,
  sub,
  total,
  collected,
  overdue,
  fees,
  portfolio,
  labels,
  money,
}: {
  title: string;
  sub: string;
  total: number;
  collected: number;
  overdue: number;
  fees: number;
  portfolio?: { grossValue: number; netValue: number; paid: number; awaiting: number; overdue: number; notYetDue: number; unscheduled: number };
  labels: {
    ofValue: string;
    collected: string;
    notYetDue: string;
    overdue: string;
    fees: string;
    awaiting?: string;
    unscheduled?: string;
    markupNote?: (markup: string, net: string) => string;
  };
  money: Money;
}) {
  const base = portfolio ? portfolio.grossValue : total;
  const cols = (
    portfolio
      ? [
          { key: 'paid', label: labels.collected, value: portfolio.paid, color: 'bg-[#C8A24B]' },
          { key: 'notYetDue', label: labels.notYetDue, value: portfolio.notYetDue, color: 'bg-[#22355A] dark:bg-[#3A4A6B]' },
          { key: 'overdue', label: labels.overdue, value: portfolio.overdue, color: 'bg-danger-600' },
          { key: 'awaiting', label: labels.awaiting ?? '', value: portfolio.awaiting, color: 'bg-amber-500' },
          { key: 'unscheduled', label: labels.unscheduled ?? '', value: portfolio.unscheduled, color: 'bg-slate-400' },
        ].filter((c) => c.key === 'paid' || c.key === 'notYetDue' || c.key === 'overdue' || c.value > 0)
      : [
          { key: 'paid', label: labels.collected, value: collected, color: 'bg-[#C8A24B]' },
          { key: 'notYetDue', label: labels.notYetDue, value: Math.max(0, total - collected - overdue), color: 'bg-[#22355A] dark:bg-[#3A4A6B]' },
          { key: 'overdue', label: labels.overdue, value: overdue, color: 'bg-danger-600' },
        ]
  );
  const shares = sharesOf(cols.map((c) => c.value), base);
  const paidPct = Math.round(shares[0] ?? 0);
  const markup = portfolio ? Math.max(0, portfolio.grossValue - portfolio.netValue) : 0;
  const paid = cols[0]?.value ?? 0;
  return (
    <Panel title={title} sub={sub}>
      <div className="flex flex-wrap items-center gap-5">
        <Ring pct={paidPct} size={92} stroke={9} />
        <div className="min-w-0">
          <p className="text-[13px] text-slate-500">{labels.ofValue}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-2">
            <Amount value={paid} money={money} className="text-[26px]" />
            <span className="text-[13px] text-slate-500">/ {compactParts(base, money.symbol, money.locale).join(' ')}</span>
          </p>
          {portfolio && markup > 0 && labels.markupNote && (
            <p className="mt-1.5 text-[12px] text-slate-500" data-testid="health-markup">
              {labels.markupNote(
                compactParts(markup, money.symbol, money.locale).join(' '),
                compactParts(portfolio.netValue, money.symbol, money.locale).join(' '),
              )}
            </p>
          )}
        </div>
        {fees > 0 && (
          <div className="ms-auto text-end">
            <p className="text-[12px] text-slate-500">{labels.fees}</p>
            <Amount value={fees} money={money} className="text-[16px]" />
          </div>
        )}
      </div>
      <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={cols.map((c, i) => `${c.label} ${shareText(shares[i] ?? 0)}`).join('، ')}>
        {cols.map((c) => (c.value > 0 ? <span key={c.key} className={c.color} style={{ flexGrow: c.value, flexBasis: 0 }} /> : null))}
        {base === 0 && <span className="flex-1 bg-surface-sunken" />}
      </div>
      <div className={cn('mt-[18px] grid grid-cols-2 gap-2.5', cols.length >= 5 ? 'lg:grid-cols-5' : cols.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')} data-testid="health-parts">
        {cols.map((c, i) => (
          <div key={c.key} className="flex flex-col gap-1 rounded-[14px] border border-hairline bg-surface-muted px-4 py-3.5" data-testid={`health-${c.key}`} data-amount={c.value}>
            <span className="flex items-center gap-1.5 text-[12px] text-slate-600">
              <span className={cn('h-2 w-2 rounded-sm', c.color)} aria-hidden />
              {c.label}
            </span>
            <Amount value={c.value} money={money} className="text-[17px]" unitClassName="text-[11px]" />
            <span className="num text-[11px] text-slate-500">{shareText(shares[i] ?? 0)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Lead sources ─────────────────────────────────────────────────────────────

// Slice colours: --slice-0…4 on .dash-v2 (globals.css), lighter in dark mode.

export function LeadSourcesV2({
  title,
  sub,
  centerSub,
  empty,
  slices,
  otherLabel,
}: {
  title: string;
  sub: string;
  centerSub: string;
  empty: string;
  slices: Array<{ label: string; value: number }>;
  otherLabel: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const rest = sorted.slice(4).reduce((a, s) => a + s.value, 0);
  const rows = sorted.length > 5 ? [...sorted.slice(0, 4), { label: otherLabel, value: rest }] : sorted;
  const size = 190;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <Panel title={title} sub={sub}>
      {total === 0 ? (
        <p className="text-[13px] text-slate-500">{empty}</p>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-5">
          <div className="relative mx-auto" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" aria-hidden>
              {rows.map((s, i) => {
                const len = (c * s.value) / total;
                const el = (
                  <circle
                    key={`${s.label}-${i}`}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    strokeWidth={stroke}
                    strokeDasharray={`${Math.max(0, len - 3)} ${c - Math.max(0, len - 3)}`}
                    strokeDashoffset={-off}
                    style={{ stroke: `var(--slice-${i})` }}
                  />
                );
                off += len;
                return el;
              })}
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-[30px] font-semibold text-slate-900">{total.toLocaleString('en')}</span>
              <span className="text-[12px] text-slate-500">{centerSub}</span>
            </span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {rows.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex items-center gap-2.5 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--slice-${i})` }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-slate-900">{s.label}</span>
                <span className="num font-semibold text-slate-900">{s.value}</span>
                <span className="num w-10 text-end text-slate-500">{Math.round((s.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ── Cash-flow forecast ───────────────────────────────────────────────────────

export function CashFlowV2({
  title,
  sub,
  link,
  slots,
  pctOfTotal,
  money,
}: {
  title: string;
  sub: ReactNode;
  link: { href: string; label: string };
  slots: Array<{ label: string; value: number; overdue?: boolean }>;
  pctOfTotal: (pct: number) => string;
  money: Money;
}) {
  const total = slots.reduce((a, s) => a + s.value, 0);
  return (
    <Panel title={title} sub={sub} link={link}>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {slots.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={s.label}
              className={cn('flex flex-col gap-2.5 rounded-[18px] border border-hairline p-5', s.overdue ? 'bg-danger-600/[0.07]' : 'bg-surface-muted')}
            >
              <p className={cn('text-[13px] font-semibold', s.overdue ? 'text-danger-700 dark:text-[#F06A6A]' : 'text-slate-600')}>{s.label}</p>
              <Amount value={s.value} money={money} className="text-[26px]" />
              <div className="h-1.5 rounded-full bg-surface-sunken">
                <div className={cn('h-full rounded-full', s.overdue ? 'bg-danger-600' : GOLD)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[12px] text-slate-500">{pctOfTotal(pct)}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
