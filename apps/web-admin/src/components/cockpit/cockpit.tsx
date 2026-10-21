import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Building blocks of the sales and manager homes (the "cockpit"): a navy
 * command band with the month's target ring, stat tiles, the lead board and
 * the agenda. The band keeps its navy in both themes, like the KPI strip.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  if (!parts.length) return '؟';
  // Skip the Arabic article: "رامي الشريف" reads رش.
  const lead = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.charAt(2) : w.charAt(0));
  if (parts.length === 1) return lead(parts[0]!).toUpperCase();
  return (lead(parts[0]!) + lead(parts[parts.length - 1]!)).toUpperCase();
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-700/15 font-bold text-brand-700 ring-1 ring-brand-500/30',
        size === 'sm' && 'h-7 w-7 text-[10.5px]',
        size === 'md' && 'h-9 w-9 text-[12px]',
        size === 'lg' && 'h-12 w-12 text-[15px]',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// ── Target ring ───────────────────────────────────────────────────────────────

/** A gold ring filled to `pct` (0–100+), the figure in its middle. */
export function TargetRing({ pct, size = 132, children }: { pct: number | null; size?: number; children: ReactNode }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.10)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#cockpit-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
        />
        <defs>
          <linearGradient id="cockpit-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F2D99A" />
            <stop offset="100%" stopColor="#B8913F" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ── Command band ──────────────────────────────────────────────────────────────

export function CommandBand({
  kicker,
  greeting,
  summary,
  actions,
  ring,
  facts,
}: {
  kicker: string;
  greeting: string;
  summary: string;
  actions: ReactNode;
  /** The target ring and its caption. */
  ring: ReactNode;
  /** Small figures along the bottom of the band. */
  facts?: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <section
      data-testid="command-band"
      className="relative overflow-hidden rounded-[26px] border border-[#D8B66A]/[0.28] bg-navy-band text-[#F4ECD8] shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]"
    >
      <div className="pointer-events-none absolute -top-24 start-[-6rem] h-72 w-72 rounded-full bg-[#D8B66A]/[0.10] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-7rem] end-[-5rem] h-72 w-72 rounded-full bg-sky-400/[0.06] blur-3xl" />
      <div className="relative grid gap-8 p-7 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0 space-y-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#D8B66A]">{kicker}</p>
          {/* Explicit colour: the global heading colour is dark in the light theme, the band stays navy. */}
          <h1 className="font-heading text-[30px] font-bold leading-tight text-[#F4ECD8] sm:text-[34px]">{greeting}</h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-[#A9B0BD]">{summary}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
        </div>
        <div className="flex items-center gap-6">{ring}</div>
      </div>
      {facts && facts.length > 0 && (
        <dl className="relative grid grid-cols-2 gap-px border-t border-[#D8B66A]/[0.16] bg-[#D8B66A]/[0.16] sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="bg-navy-band px-7 py-4">
              <dt className="text-[12px] text-[#A9B0BD]">{f.label}</dt>
              <dd className="mt-1 text-[20px] font-bold tabular-nums text-[#F4ECD8]">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** A quick action in the band: gold for the main one, glass for the rest. */
export function BandAction({ href, icon, children, primary }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors [&_svg]:h-4 [&_svg]:w-4',
        primary
          ? 'bg-gradient-to-l from-[#E6C77E] to-[#C9A24E] text-[#1a1408] hover:brightness-105'
          : 'border border-white/15 bg-white/[0.06] text-[#F4ECD8] hover:bg-white/[0.12]',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

const TILE_TONE = {
  brand:   'bg-brand-500/12 text-brand-700',
  sky:     'bg-sky-500/12 text-sky-600',
  violet:  'bg-violet-500/12 text-violet-600',
  emerald: 'bg-emerald-500/12 text-emerald-600',
} as const;

export function StatTile({
  href,
  icon,
  label,
  value,
  note,
  noteTone = 'muted',
  tone = 'brand',
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  note: string;
  noteTone?: 'muted' | 'warning' | 'success';
  tone?: keyof typeof TILE_TONE;
}) {
  return (
    <Link
      href={href as never}
      data-testid="stat-tile"
      className="group relative flex flex-col justify-between gap-4 overflow-hidden rounded-[22px] border border-hairline bg-surface p-5 transition-colors hover:border-brand-500/40"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-slate-500">{label}</p>
        <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]', TILE_TONE[tone])}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-[34px] font-bold leading-none tabular-nums text-slate-900">{value}</p>
        <p
          className={cn(
            'mt-2 text-[12px] font-semibold',
            noteTone === 'warning' ? 'text-amber-600' : noteTone === 'success' ? 'text-emerald-600' : 'text-slate-500',
          )}
        >
          {note}
        </p>
      </div>
      <ArrowUpRight className="absolute bottom-5 end-5 h-4 w-4 text-slate-300 transition-colors group-hover:text-brand-700 rtl:-scale-x-100" />
    </Link>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────────

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
    <section data-testid={testId} className={cn('flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface', className)}>
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

// ── Lead board ────────────────────────────────────────────────────────────────

export const BOARD_STAGES = [
  { stage: 'NEW',         bar: 'bg-slate-400',  text: 'text-slate-600'  },
  { stage: 'INTERESTED',  bar: 'bg-sky-400',    text: 'text-sky-600'    },
  { stage: 'VISIT',       bar: 'bg-violet-400', text: 'text-violet-600' },
  { stage: 'NEGOTIATION', bar: 'bg-amber-400',  text: 'text-amber-600'  },
] as const;

export interface BoardCard {
  id: string;
  name: string;
  project?: string;
  age: string;
  stale?: boolean;
  owner?: string;
}

export function LeadBoard({
  columns,
  emptyLabel,
  viewAllLabel,
  staleLabel,
}: {
  columns: Array<{ stage: string; label: string; count: number; cards: BoardCard[] }>;
  emptyLabel: string;
  viewAllLabel: string;
  staleLabel: string;
}) {
  const total = columns.reduce((a, c) => a + c.count, 0);
  return (
    <div className="space-y-4 px-6 pb-6">
      {total > 0 && (
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" dir="ltr">
          {columns.filter((c) => c.count > 0).map((c) => {
            const meta = BOARD_STAGES.find((s) => s.stage === c.stage)!;
            return <div key={c.stage} className={cn('h-full', meta.bar)} style={{ width: `${(c.count / total) * 100}%` }} />;
          })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="lead-board">
        {columns.map((col) => {
          const meta = BOARD_STAGES.find((s) => s.stage === col.stage)!;
          return (
            <div key={col.stage} className="flex flex-col rounded-2xl border border-hairline bg-surface-muted/30">
              <Link
                href={`/dashboard/leads?stage=${col.stage}` as never}
                className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3 hover:text-brand-700"
              >
                <span className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
                  <span className={cn('h-2.5 w-2.5 rounded-full', meta.bar)} />
                  {col.label}
                </span>
                <span className={cn('text-[18px] font-bold tabular-nums', meta.text)}>{col.count}</span>
              </Link>
              <ul className="flex-1 space-y-2 p-2.5">
                {col.cards.length === 0 ? (
                  <li className="px-2 py-5 text-center text-[12px] text-slate-400">{emptyLabel}</li>
                ) : (
                  col.cards.map((card) => (
                    <li key={card.id}>
                      <Link
                        href={`/dashboard/leads/${card.id}` as never}
                        className="block rounded-xl border border-hairline bg-surface px-3 py-2.5 transition-colors hover:border-brand-500/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-slate-900" dir="auto">{card.name}</p>
                          {card.stale && (
                            <span className="shrink-0 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">{staleLabel}</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
                          {card.project ?? '—'} · {card.age}
                        </p>
                        {card.owner && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Avatar name={card.owner} size="sm" className="h-5 w-5 text-[8.5px]" />
                            <span className="truncate">{card.owner}</span>
                          </p>
                        )}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
              {col.count > col.cards.length && (
                <Link
                  href={`/dashboard/leads?stage=${col.stage}` as never}
                  className="border-t border-hairline px-4 py-2.5 text-center text-[12px] font-bold text-brand-700 hover:text-brand-600"
                >
                  {viewAllLabel} ({col.count})
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda ────────────────────────────────────────────────────────────────────

export interface AgendaItem {
  id: string;
  href: string;
  /** Day group heading (اليوم / غداً / a date). */
  day: string;
  time: string;
  title: string;
  sub: string;
  tone: 'visit' | 'warning' | 'danger';
}

const AGENDA_DOT = {
  visit: 'bg-sky-400 ring-sky-400/25',
  warning: 'bg-amber-400 ring-amber-400/25',
  danger: 'bg-rose-400 ring-rose-400/25',
} as const;

export function Agenda({ items, emptyLabel }: { items: AgendaItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{emptyLabel}</p>;
  }
  const days: Array<{ day: string; items: AgendaItem[] }> = [];
  for (const it of items) {
    const g = days.find((d) => d.day === it.day);
    if (g) g.items.push(it);
    else days.push({ day: it.day, items: [it] });
  }
  return (
    <div className="space-y-5 px-6 pb-6" data-testid="agenda">
      {days.map((g) => (
        <div key={g.day}>
          <p className="mb-2 text-[12px] font-bold text-brand-700">{g.day}</p>
          <ol className="relative space-y-1 border-s border-hairline ps-4">
            {g.items.map((it) => (
              <li key={it.id} className="relative">
                <span className={cn('absolute -start-[21px] top-3.5 h-2.5 w-2.5 rounded-full ring-4', AGENDA_DOT[it.tone])} />
                <Link href={it.href as never} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted/50">
                  <span className="w-14 shrink-0 text-[12px] font-bold tabular-nums text-slate-700" dir="ltr">{it.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-900" dir="auto">{it.title}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{it.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ── Bookings by expiry ────────────────────────────────────────────────────────

export interface ExpiryCard {
  id: string;
  href: string;
  code: string;
  unit?: string;
  client: string;
  owner?: string;
  /** Whole days until it lapses (0 = today). */
  daysLeft: number;
  expiryLabel: string;
  status: ReactNode;
}

/** Active bookings as cards, the time left as a draining bar (7 days = full). */
export function ExpiryCards({ items, emptyLabel, cols = 3 }: { items: ExpiryCard[]; emptyLabel: string; cols?: 2 | 3 }) {
  if (items.length === 0) {
    return <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className={cn('grid grid-cols-1 gap-3 px-6 pb-6 sm:grid-cols-2', cols === 3 && 'xl:grid-cols-3')} data-testid="expiry-cards">
      {items.map((r) => {
        const urgent = r.daysLeft <= 1;
        const soon = r.daysLeft <= 7;
        const fill = Math.max(4, Math.min(100, (r.daysLeft / 7) * 100));
        return (
          <Link
            key={r.id}
            href={r.href as never}
            className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-muted/30 p-4 transition-colors hover:border-brand-500/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[12.5px] font-bold text-slate-900" dir="ltr">
                  {r.code}{r.unit ? ` · ${r.unit}` : ''}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-slate-500" dir="auto">
                  {r.client}{r.owner ? ` · ${r.owner}` : ''}
                </p>
              </div>
              {r.status}
            </div>
            <div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className={cn('font-bold', urgent ? 'text-rose-500' : soon ? 'text-amber-600' : 'text-slate-500')}>{r.expiryLabel}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={cn('h-full rounded-full', urgent ? 'bg-rose-400' : soon ? 'bg-amber-400' : 'bg-emerald-400')}
                  style={{ width: `${fill}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
