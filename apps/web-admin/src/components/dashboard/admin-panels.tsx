import type { ReactNode } from 'react';
import Link from 'next/link';
import { Banknote, Bookmark, CalendarCheck2, FileText, MessageSquare, Receipt, UserPlus, Wrench } from 'lucide-react';
import { cn } from '@/lib/cn';
import { compactParts } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { PremiumPanel, PremiumEmptyNote, PremiumBars } from '@/components/premium';
import { NumCell, UnitsBar } from '@/components/premium/data-table';

/**
 * The admin dashboard panels (U5, docs/HANDOFF.md). Each takes plain numbers
 * and labels; no data fetching here.
 */

type Money = { symbol: string; locale: Locale };

function Money({ value, money, size = 'md' }: { value: number; money: Money; size?: 'md' | 'lg' }) {
  const [num, unit] = compactParts(value, money.symbol, money.locale);
  return <NumCell value={num} unit={unit} className={size === 'lg' ? '[&>span:first-child]:text-[34px]' : '[&>span:first-child]:text-[26px]'} />;
}

// ── Needs action ─────────────────────────────────────────────────────────────

export interface ActionItem {
  key: string;
  label: string;
  value: number;
  href: string;
  icon: 'contracts' | 'maintenance' | 'visits' | 'requests' | 'payments';
}

const ACTION_ICON: Record<ActionItem['icon'], ReactNode> = {
  contracts: <FileText />,
  maintenance: <Wrench />,
  visits: <CalendarCheck2 />,
  requests: <MessageSquare />,
  payments: <Receipt />,
};

/** "Needs action": a status line, then four hairline-divided tiles. */
export function NeedsActionPanel({ title, allClear, items }: { title: string; allClear: string; items: ActionItem[] }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
      <header className="flex flex-wrap items-center gap-3 px-6 py-4">
        <h2 className="font-heading text-[19px] font-bold text-slate-900">{title}</h2>
        {total === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden />
            {allClear}
          </span>
        ) : (
          <span className="num rounded-full bg-danger-50 px-2.5 text-[18px] font-semibold text-danger-700">{total}</span>
        )}
      </header>
      <div className={cn('grid grid-cols-2 gap-px border-t border-hairline bg-hairline', items.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href as never}
            className="flex items-center gap-4 bg-surface px-6 py-5 transition-colors hover:bg-surface-muted"
          >
            <span
              className={cn(
                'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border [&_svg]:h-4 [&_svg]:w-4',
                it.value > 0 ? 'border-brand-400/50 bg-brand-50 text-brand-700' : 'border-hairline text-slate-500',
              )}
            >
              {ACTION_ICON[it.icon]}
            </span>
            <span className="min-w-0">
              <span className={cn('num block text-[30px] font-semibold leading-none', it.value > 0 ? 'text-slate-900' : 'text-slate-500')}>
                {it.value}
              </span>
              <span className="mt-1 block truncate text-[13px] text-slate-600">{it.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Recent activity ──────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  type: string;
  who: string;
  action: string;
  ref: string | null;
  when: string;
  href?: string;
  amount?: number;
}

/** Same person + same kind in a row become one line ("3 payments · 120K"). */
export function groupActivity(items: ActivityItem[], groupedLabel: (n: number) => string): Array<ActivityItem & { count: number }> {
  const out: Array<ActivityItem & { count: number }> = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && prev.type === it.type && prev.who === it.who && it.type === 'deposit') {
      prev.count += 1;
      prev.amount = (prev.amount ?? 0) + (it.amount ?? 0);
      prev.action = groupedLabel(prev.count);
      prev.href = undefined;
      if (prev.ref !== it.ref) prev.ref = null;
      continue;
    }
    out.push({ ...it, count: 1 });
  }
  return out;
}

const ACTIVITY_ICON: Record<string, ReactNode> = {
  deposit: <Banknote />,
  reservation: <Bookmark />,
  lead: <UserPlus />,
  contract: <FileText />,
  visit: <CalendarCheck2 />,
  maintenance: <Wrench />,
  info_request: <MessageSquare />,
};

export function ActivityPanel({
  title,
  sub,
  link,
  empty,
  items,
  money,
  className,
}: {
  title: string;
  sub: string;
  link: { href: string; label: string };
  empty: string;
  items: Array<ActivityItem & { count: number }>;
  money: Money;
  className?: string;
}) {
  return (
    <PremiumPanel title={title} sub={sub} link={link} padding="none" className={className}>
      {items.length === 0 ? (
        <div className="px-6 pb-6"><PremiumEmptyNote>{empty}</PremiumEmptyNote></div>
      ) : (
        <ul>
          {items.map((it) => {
            const body = (
              <>
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-400/50 text-brand-700 [&_svg]:h-4 [&_svg]:w-4">
                  {ACTIVITY_ICON[it.type] ?? <FileText />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold text-slate-900">{it.who}</span>
                  <span className="block truncate text-[12.5px] text-slate-500">
                    {it.action}
                    {it.ref && <> · <bdi className="font-mono" dir="ltr">{it.ref}</bdi></>}
                  </span>
                </span>
                {it.amount !== undefined && it.amount > 0 && <Money value={it.amount} money={money} />}
                <span className="shrink-0 text-[12px] text-slate-500">{it.when}</span>
              </>
            );
            return (
              <li key={it.id} className="border-t border-hairline">
                {it.href ? (
                  <Link href={it.href as never} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-surface-muted">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 px-6 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PremiumPanel>
  );
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

export interface LeaderRow {
  id: string;
  name: string;
  sub: string;
  value: number;
}

/** Ranked people; when nobody has a figure yet, one line instead of a ranking of zeros. */
export function LeaderboardPanel({
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
    <PremiumPanel title={title} sub={sub} link={link} className={className}>
      {ranked.length === 0 ? (
        <PremiumEmptyNote>{empty}</PremiumEmptyNote>
      ) : (
        <ol className="space-y-3">
          {ranked.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3">
              <span
                className={cn(
                  'num inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-semibold',
                  i === 0 ? 'border-brand-400/70 text-brand-700' : 'border-hairline text-slate-600',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-slate-900">{r.name}</span>
                <span className="block text-[12px] text-slate-500">{r.sub}</span>
              </span>
              <Money value={r.value} money={money} />
            </li>
          ))}
        </ol>
      )}
    </PremiumPanel>
  );
}

// ── Monthly bookings (bars) ──────────────────────────────────────────────────

/** Small integers per month: bars with the value on each, not a smoothed line. */
export function MonthlyBarsPanel({
  title,
  sub,
  badge,
  empty,
  data,
}: {
  title: string;
  sub: string;
  badge: string;
  empty: string;
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <PremiumPanel
      title={title}
      sub={sub}
      trailing={<span className="rounded-full border border-brand-400/50 px-3 py-1 text-[12px] font-bold text-brand-700">{badge}</span>}
    >
      {max === 0 ? (
        <PremiumEmptyNote>{empty}</PremiumEmptyNote>
      ) : (
        <PremiumBars data={data} highlight={[data.length - 1]} height={200} />
      )}
    </PremiumPanel>
  );
}

// ── Sales funnel ─────────────────────────────────────────────────────────────

export interface FunnelStage {
  label: string;
  value: number;
  /** A conversion line under the bar — only where this stage is a subset of the previous one. */
  note?: string;
}

/** Slim bars scaled to the largest stage. */
export function FunnelPanel({
  title,
  sub,
  stages,
  footnote,
  className,
}: {
  title: string;
  sub: string;
  stages: FunnelStage[];
  footnote?: string;
  className?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <PremiumPanel title={title} sub={sub} className={className}>
      <div className="space-y-4">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-bold text-slate-900">{s.label}</span>
              <span className="num text-[22px] font-semibold text-slate-900">{s.value}</span>
            </div>
            <div className="mt-1.5 h-[5px] rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]"
                style={{ width: `${(s.value / max) * 100}%` }}
              />
            </div>
            {s.note && <p className="mt-1 text-[12px] text-slate-500">{s.note}</p>}
          </div>
        ))}
        {footnote && <p className="border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-slate-500">{footnote}</p>}
      </div>
    </PremiumPanel>
  );
}

// ── Project health ───────────────────────────────────────────────────────────

export interface ProjectHealth {
  id: string;
  name: string;
  sold: number;
  reserved: number;
  available: number;
  signed: number;
  value: number;
}

export function ProjectHealthPanel({
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
  projects: ProjectHealth[];
  labels: { sold: string; reserved: string; available: string; signed: (n: number) => string };
  money: Money;
}) {
  return (
    <PremiumPanel title={title} sub={sub} link={link}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/projects/${p.id}` as never}
            className="rounded-[18px] border border-hairline bg-surface-muted p-5 transition-colors hover:border-brand-400/50"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-heading text-[16px] font-bold text-slate-900">{p.name}</span>
              <Money value={p.value} money={money} />
            </div>
            <UnitsBar className="mt-3" counts={{ sold: p.sold, reserved: p.reserved, available: p.available }} labels={labels} />
            <p className="mt-3 border-t border-hairline pt-3 text-[12.5px] text-slate-500">{labels.signed(p.signed)}</p>
          </Link>
        ))}
      </div>
    </PremiumPanel>
  );
}

// ── Financial health ─────────────────────────────────────────────────────────

export function FinancialHealthPanel({
  title,
  sub,
  total,
  collected,
  overdue,
  fees,
  labels,
  money,
  className,
}: {
  title: string;
  sub: string;
  total: number;
  collected: number;
  overdue: number;
  fees: number;
  labels: { ofValue: string; collected: string; notYetDue: string; overdue: string; fees: string };
  money: Money;
  className?: string;
}) {
  const notYetDue = Math.max(0, total - collected - overdue);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const cols = [
    { label: labels.collected, value: collected, dot: 'bg-unit-sold' },
    { label: labels.notYetDue, value: notYetDue, dot: 'bg-unit-reserved' },
    { label: labels.overdue, value: overdue, dot: 'border border-danger-600 bg-transparent' },
  ];
  return (
    <PremiumPanel title={title} sub={sub} className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Money value={total} money={money} size="lg" />
        <p className="text-[13px] text-slate-500">
          {labels.ofValue} <span className="num text-[22px] font-semibold text-slate-900">{pct(collected)}%</span>
        </p>
      </div>
      <div className="mt-4 flex h-2 gap-1" role="img" aria-label={cols.map((c) => `${c.label} ${pct(c.value)}%`).join('، ')}>
        {collected > 0 && <span className="rounded-full bg-unit-sold" style={{ flexGrow: collected, flexBasis: 0 }} />}
        {notYetDue > 0 && <span className="rounded-full bg-unit-reserved" style={{ flexGrow: notYetDue, flexBasis: 0 }} />}
        {overdue > 0 && <span className="rounded-full bg-danger-600" style={{ flexGrow: overdue, flexBasis: 0 }} />}
        {total === 0 && <span className="flex-1 rounded-full bg-surface-sunken" />}
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-hairline rtl:divide-x-reverse">
        {cols.map((c) => (
          <div key={c.label} className="px-4 first:ps-0">
            <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
              <span className={cn('h-2 w-2 rounded-full', c.dot)} aria-hidden />
              {c.label}
            </p>
            <div className="mt-1"><Money value={c.value} money={money} /></div>
            <p className="text-[12px] text-slate-500">{pct(c.value)}%</p>
          </div>
        ))}
      </div>
      {fees > 0 && (
        <p className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[13px] text-slate-500">
          {labels.fees}
          <Money value={fees} money={money} />
        </p>
      )}
    </PremiumPanel>
  );
}

// ── Lead sources ─────────────────────────────────────────────────────────────

export function LeadSourcesPanel({
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
  /** Label for the sources folded together past the top four. */
  otherLabel: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  // Five rows at most beside the ring: the top four, the rest as one.
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const rest = sorted.slice(4).reduce((a, s) => a + s.value, 0);
  const rows = sorted.length > 5 ? [...sorted.slice(0, 4), { label: otherLabel, value: rest }] : sorted;
  return (
    <PremiumPanel title={title} sub={sub}>
      {total === 0 ? (
        <PremiumEmptyNote>{empty}</PremiumEmptyNote>
      ) : (
        // Ring and list stay side by side at any width (they used to wrap
        // the ring above the list in a narrow column).
        <div className="flex items-center gap-5">
          <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-full border-[6px] border-[#C79A3B]">
            <span className="num text-[38px] font-semibold leading-none text-slate-900">{total}</span>
            <span className="mt-1 text-[11px] text-slate-500">{centerSub}</span>
          </div>
          <ul className="min-w-0 flex-1 space-y-3">
            {rows.map((s) => {
              const pct = Math.round((s.value / total) * 100);
              return (
                <li key={s.label}>
                  <div className="flex items-center justify-between text-[13.5px]">
                    <span className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="h-2 w-2 rounded-full bg-[#C79A3B]" aria-hidden />
                      {s.label}
                    </span>
                    <span className="text-slate-500">{pct}% · {s.value}</span>
                  </div>
                  <div className="mt-1.5 h-[3px] rounded-full bg-surface-sunken">
                    <div className="h-full rounded-full bg-[#C79A3B]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PremiumPanel>
  );
}

// ── Cash-flow forecast ───────────────────────────────────────────────────────

export function CashFlowPanel({
  title,
  sub,
  link,
  slots,
  pctOfTotal,
  money,
  className,
}: {
  title: string;
  sub: ReactNode;
  link: { href: string; label: string };
  slots: Array<{ label: string; value: number; overdue?: boolean }>;
  pctOfTotal: (pct: number) => string;
  money: Money;
  className?: string;
}) {
  const total = slots.reduce((a, s) => a + s.value, 0);
  return (
    <PremiumPanel title={title} sub={sub} link={link} padding="none" className={className}>
      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline lg:grid-cols-4">
        {slots.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="bg-surface px-6 py-5">
              <p className="text-[12.5px] text-slate-500">{s.label}</p>
              <div className="mt-1"><Money value={s.value} money={money} /></div>
              <div className="mt-3 h-[3px] rounded-full bg-surface-sunken">
                <div className={cn('h-full rounded-full', s.overdue ? 'bg-danger-600' : 'bg-[#C79A3B]')} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-slate-500">{pctOfTotal(pct)}</p>
            </div>
          );
        })}
      </div>
    </PremiumPanel>
  );
}
