import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, PauseCircle, RotateCcw, Scale, Search } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getLocale, type Locale } from '@/lib/locale';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { projectOptions as fetchProjectOptions } from '@/lib/options';
import type { Paged } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { PremiumFilterBar, PremiumFilterField, PremiumPageHero } from '@/components/premium';
import { compactFigure } from '@/components/premium/metric-strip';
import { EntityLink } from '@/components/entity-link';
import { ledgerT } from './messages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── API shapes (GET /reports/ledger, /reports/ledger/rows) ───────────────────
type Fig = { amount: string; count: number };
type State = 'late' | 'dueToday' | 'upcoming' | 'onItsWay' | 'pendingApproval';
type GroupFig = Fig & { states?: Partial<Record<State, Fig>> };
interface LedgerSummary {
  asOf: string;
  receivables: { total: string; groups: Record<'installments' | 'bookings' | 'fees' | 'clawbacks', GroupFig> };
  payables: { total: string; groups: Record<'commissions' | 'topUps' | 'bonuses' | 'refunds', GroupFig>; onHold: Fig };
  net: string;
}
interface LedgerRow {
  id: string;
  type: string;
  date: string | null;
  amount: string;
  state: State;
  party: { kind: 'customer' | 'client' | 'broker' | 'sales'; id: string | null; name: string | null } | null;
  contract: { id: string; number: string | null } | null;
  unit: { id: string; code: string } | null;
  reservation: { id: string; number: string | null } | null;
  ref: { kind: string; id: string; code: string | null } | null;
  payout: { id: string; number: string | null } | null;
}

type Side = 'receivables' | 'payables';
type Group = 'installments' | 'bookings' | 'fees' | 'clawbacks' | 'commissions' | 'topUps' | 'bonuses' | 'refunds' | 'onHold';
const GROUPS: Record<Side, Group[]> = {
  receivables: ['installments', 'bookings', 'fees', 'clawbacks'],
  payables: ['commissions', 'bonuses', 'topUps', 'refunds'],
};
const sideOf = (g: Group): Side => (GROUPS.receivables.includes(g) ? 'receivables' : 'payables');
const PERIODS = ['all', 'thisMonth', 'nextMonth', 'quarter', 'year', 'custom'] as const;
type Period = (typeof PERIODS)[number];

interface Search {
  group?: string; state?: string; page?: string;
  period?: string; dateFrom?: string; dateTo?: string; projectId?: string; q?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

/** The period's first and last day, in the company's calendar. */
function periodRange(period: Period, today: string, sp: Search): { dateFrom?: string; dateTo?: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (period) {
    case 'thisMonth':
      return { dateFrom: `${y}-${pad(m)}-01`, dateTo: lastDay(y, m) };
    case 'nextMonth': {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return { dateFrom: `${ny}-${pad(nm)}-01`, dateTo: lastDay(ny, nm) };
    }
    case 'quarter': {
      const q0 = Math.floor((m - 1) / 3) * 3 + 1;
      return { dateFrom: `${y}-${pad(q0)}-01`, dateTo: lastDay(y, q0 + 2) };
    }
    case 'year':
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
    case 'custom':
      return { dateFrom: sp.dateFrom || undefined, dateTo: sp.dateTo || undefined };
    default:
      return {};
  }
}

/** One colour per state, shared by the bars, the legend and the badges. */
const STATE_DOT: Record<State, string> = {
  late: 'bg-danger-500',
  dueToday: 'bg-warning-500',
  upcoming: 'bg-slate-300',
  onItsWay: 'bg-[#C9A24E]',
  pendingApproval: 'bg-slate-400',
};
const STATE_BADGE: Record<State, string> = {
  late: 'bg-danger-50 text-danger-700 ring-danger-100',
  dueToday: 'bg-warning-50 text-warning-700 ring-warning-100',
  upcoming: 'bg-surface-muted text-slate-600 ring-hairline',
  onItsWay: 'bg-brand-50 text-brand-700 ring-brand-400/30',
  pendingApproval: 'bg-surface-muted text-slate-600 ring-hairline',
};
const SIDE_STATES: Record<Side, State[]> = {
  receivables: ['late', 'dueToday', 'upcoming', 'onItsWay'],
  payables: ['late', 'pendingApproval'],
};

const n = (v: string | number | null | undefined) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** A large figure as on the metric band: short number, unit beside it, full amount on hover. */
function Figure({ value, currency, locale, size = 'lg', tone = 'ink' }: {
  value: number; currency: string; locale: Locale; size?: 'xl' | 'lg'; tone?: 'ink' | 'cream';
}) {
  const full = formatCurrency(value, currency, locale);
  const [num, unit] = compactFigure(String(Math.abs(value).toFixed(2)).replace(/\.00$/, ''), currency === 'EGP' && locale === 'ar' ? 'ج.م' : currency, locale === 'ar');
  return (
    <span className="inline-flex items-baseline gap-2" title={full}>
      <span className={cn('num font-semibold leading-none', size === 'xl' ? 'text-[52px]' : 'text-[40px]', tone === 'cream' ? 'text-[#F4ECD8]' : 'text-slate-900')}>
        {value < 0 ? '−' : ''}{num}
      </span>
      <span className={cn('text-[13px] font-bold', tone === 'cream' ? 'text-[#D8B66A]' : 'text-brand-700')}>{unit}</span>
    </span>
  );
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = ledgerT(locale);
  const [currency, tz] = await Promise.all([getReportsCurrency(), getCompanyTimeZone()]);
  const today = todayIn(tz);
  const money = (v: string | number) => formatCurrency(v, currency, locale);

  // Dates typed without picking a preset are a custom range.
  const picked: Period = (PERIODS as readonly string[]).includes(sp.period ?? '') ? (sp.period as Period) : 'all';
  const period: Period = picked === 'all' && (sp.dateFrom || sp.dateTo) ? 'custom' : picked;
  const range = periodRange(period, today, sp);
  const allGroups = [...GROUPS.receivables, ...GROUPS.payables, 'onHold'] as Group[];
  const group: Group = allGroups.includes(sp.group as Group) ? (sp.group as Group) : 'installments';
  const side = sideOf(group);
  const state = sp.state as State | undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;

  const filter = new URLSearchParams();
  if (range.dateFrom) filter.set('dateFrom', range.dateFrom);
  if (range.dateTo) filter.set('dateTo', range.dateTo);
  if (sp.projectId) filter.set('projectId', sp.projectId);
  if (sp.q?.trim()) filter.set('q', sp.q.trim());
  const rowsQs = new URLSearchParams(filter);
  rowsQs.set('group', group);
  if (state) rowsQs.set('state', state);
  rowsQs.set('page', String(page));
  rowsQs.set('pageSize', String(pageSize));

  const [summaryRes, rowsRes, projectsRes] = await Promise.all([
    safe(api.get<LedgerSummary>(`/reports/ledger?${filter.toString()}`)),
    safe(api.get<Paged<LedgerRow>>(`/reports/ledger/rows?${rowsQs.toString()}`)),
    safe(fetchProjectOptions()),
  ]);
  const s = summaryRes.data;
  const rows = rowsRes.data;
  const projects = projectsRes.data?.data ?? [];

  // Links keep the filters; choosing a group starts its rows over.
  const keep = { period: period === 'all' ? undefined : period, dateFrom: sp.dateFrom, dateTo: sp.dateTo, projectId: sp.projectId, q: sp.q };
  const href = (over: Partial<Search>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, group, ...over })) if (v) qs.set(k, String(v));
    return `/dashboard/ledger?${qs.toString()}#ledger-detail`;
  };

  const figOf = (g: Group): GroupFig | null => {
    if (!s) return null;
    if (g === 'onHold') return s.payables.onHold;
    return sideOf(g) === 'receivables'
      ? s.receivables.groups[g as keyof LedgerSummary['receivables']['groups']]
      : s.payables.groups[g as keyof LedgerSummary['payables']['groups']];
  };
  /** A side's money by state, across its groups (a group without states is all overdue). */
  const sideStates = (sd: Side): Record<State, number> => {
    const out: Record<State, number> = { late: 0, dueToday: 0, upcoming: 0, onItsWay: 0, pendingApproval: 0 };
    for (const g of GROUPS[sd]) {
      const f = figOf(g);
      if (!f) continue;
      if (!f.states) out.late += n(f.amount);
      else for (const [k, v] of Object.entries(f.states) as Array<[State, Fig]>) out[k] += n(v.amount);
    }
    return out;
  };
  const daysSince = (d: string) =>
    Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.slice(0, 10)}T00:00:00Z`)) / 86_400_000));
  const current = figOf(group);
  const net = n(s?.net);

  /** One side: total, its money by state on one bar, then its groups. */
  const SideCard = ({ sd }: { sd: Side }) => {
    const total = n(sd === 'receivables' ? s?.receivables.total : s?.payables.total);
    const st = sideStates(sd);
    const icon = sd === 'receivables' ? <ArrowDownLeft /> : <ArrowUpRight />;
    return (
      <section
        data-testid={`ledger-side-${sd}`}
        className="flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-[0_18px_40px_-28px_rgb(20_26_38/0.35)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#C9A24E]/50 text-[#B08A3A] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.6]">
              {icon}
            </span>
            <div>
              <h2 className="font-heading text-[20px] font-bold leading-tight text-slate-900">{t.sides[sd].title}</h2>
              <p className="text-[12.5px] text-slate-500">{t.sides[sd].sub}</p>
            </div>
          </div>
          {s && <Figure value={total} currency={currency} locale={locale} />}
        </header>

        {/* Money by state on one bar, with its legend. */}
        <div className="px-6">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
            {total > 0 &&
              SIDE_STATES[sd].map((k) =>
                st[k] > 0 ? <span key={k} className={STATE_DOT[k]} style={{ width: `${(st[k] / total) * 100}%` }} /> : null,
              )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {SIDE_STATES[sd].map((k) => (
              <div key={k} title={t.statesHint[k]}>
                <dt className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  <span className={cn('h-2 w-2 rounded-full', STATE_DOT[k])} />
                  {k === 'late' ? t.sides[sd].overdue : t.states[k]}
                </dt>
                <dd className={cn('mt-0.5 text-[13.5px] font-semibold tabular-nums', k === 'late' && st[k] > 0 ? 'text-danger-700' : 'text-slate-800')}>
                  {money(st[k])}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Its groups: each opens its detail below. */}
        <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
          {GROUPS[sd].map((g) => {
            const f = figOf(g);
            const amt = n(f?.amount);
            const active = g === group;
            return (
              <li key={g}>
                <Link
                  href={href({ group: g, state: undefined, page: undefined }) as never}
                  aria-current={active ? 'true' : undefined}
                  data-testid={`ledger-group-${g}`}
                  className={cn(
                    'group relative flex items-center gap-4 px-6 py-3.5 transition-colors',
                    active ? 'bg-brand-50/60' : 'hover:bg-surface-muted/50',
                  )}
                >
                  {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[#C9A24E]" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[14px] font-semibold', active ? 'text-brand-700' : 'text-slate-800')}>{t.groups[g].title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-1 w-24 overflow-hidden rounded-full bg-surface-sunken">
                        <span className="block h-full rounded-full bg-[#C9A24E]/70" style={{ width: `${total > 0 ? (amt / total) * 100 : 0}%` }} />
                      </span>
                      <span className="text-[11px] text-slate-500">{f ? t.count(f.count) : ''}</span>
                    </div>
                  </div>
                  <span className="text-[14.5px] font-semibold tabular-nums text-slate-900">{money(amt)}</span>
                </Link>
              </li>
            );
          })}
          {sd === 'payables' && (
            <li>
              <Link
                href={href({ group: 'onHold', state: undefined, page: undefined }) as never}
                aria-current={group === 'onHold' ? 'true' : undefined}
                data-testid="ledger-group-onHold"
                className={cn(
                  'flex items-center gap-3 px-6 py-3 text-[12.5px] transition-colors',
                  group === 'onHold' ? 'bg-brand-50/60' : 'hover:bg-surface-muted/50',
                )}
              >
                <PauseCircle className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-slate-600">
                  {t.groups.onHold.title} <span className="text-slate-400">· {t.onHoldNote}</span>
                </span>
                <span className="tabular-nums text-slate-600">{money(n(s?.payables.onHold.amount))}</span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[{ label: t.home, href: '/dashboard' }, { label: t.breadcrumb }]}
      />

      {/* Position: what is owed to the company, the net, what it owes. */}
      {s && (
        <section
          data-testid="metric-strip"
          className="overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band text-[#F4ECD8] shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]"
        >
          <div className="grid gap-px bg-[#D8B66A]/[0.16] md:grid-cols-3">
            {(['receivables', 'net', 'payables'] as const).map((k) => {
              const value = k === 'net' ? net : n(k === 'receivables' ? s.receivables.total : s.payables.total);
              const overdue = k === 'net' ? 0 : sideStates(k).late;
              return (
                <div key={k} className="flex flex-col items-center gap-2 bg-navy-band px-7 py-7 text-center">
                  <p className="flex items-center justify-center gap-2 text-[13px] text-[#A9B0BD]">
                    <span className="text-[#D8B66A] [&_svg]:h-4 [&_svg]:w-4">
                      {k === 'net' ? <Scale /> : k === 'receivables' ? <ArrowDownLeft /> : <ArrowUpRight />}
                    </span>
                    {k === 'net' ? t.net.title : t.sides[k].title}
                  </p>
                  <Figure value={value} currency={currency} locale={locale} size="xl" tone="cream" />
                  <p className="text-[12px] text-[#A9B0BD]">
                    {k === 'net'
                      ? `${net >= 0 ? t.net.positive : t.net.negative} · ${t.net.asOf} ${formatDate(s.asOf, locale)}`
                      : (
                        <>
                          {t.sides[k].overdue}{' '}
                          <span className={cn('font-semibold tabular-nums', overdue > 0 ? 'text-[#F09687]' : 'text-[#86C9A0]')}>{money(overdue)}</span>
                        </>
                      )}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <PremiumFilterBar method="get" action="/dashboard/ledger" data-testid="ledger-filters">
          {sp.group && <input type="hidden" name="group" value={group} />}
          <PremiumFilterField label={t.filter.period} htmlFor="lg-period">
            <Select id="lg-period" name="period" inputSize="sm" defaultValue={period} className="w-44 shrink-0">
              {PERIODS.map((p) => (
                <option key={p} value={p}>{t.periods[p]}</option>
              ))}
            </Select>
          </PremiumFilterField>
          <PremiumFilterField label={t.filter.from} htmlFor="lg-from">
            <Input id="lg-from" name="dateFrom" type="date" inputSize="sm" defaultValue={sp.dateFrom ?? ''} className="w-40 shrink-0" />
          </PremiumFilterField>
          <PremiumFilterField label={t.filter.to} htmlFor="lg-to">
            <Input id="lg-to" name="dateTo" type="date" inputSize="sm" defaultValue={sp.dateTo ?? ''} className="w-40 shrink-0" />
          </PremiumFilterField>
          <PremiumFilterField label={t.filter.project} htmlFor="lg-project">
            <Select id="lg-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-48 shrink-0">
              <option value="">{t.filter.allProjects}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{tx(p.name, locale)}</option>
              ))}
            </Select>
          </PremiumFilterField>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="lg-q" className="sr-only">{t.filter.search}</label>
            <Input id="lg-q" name="q" inputSize="sm" placeholder={t.filter.search} defaultValue={sp.q ?? ''} leftAddon={<Search />} className="w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="submit" variant="primary" size="sm">{t.filter.apply}</Button>
            {(period !== 'all' || sp.projectId || sp.q) && (
              <Link
                href="/dashboard/ledger"
                title={t.filter.reset}
                aria-label={t.filter.reset}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-danger-500/40 hover:text-danger-600"
              >
                <RotateCcw className="h-4 w-4" />
              </Link>
            )}
          </div>
        </PremiumFilterBar>
        <p className="px-3 text-[12px] leading-relaxed text-slate-500">
          {range.dateFrom && range.dateTo && (
            <span className="me-2 font-semibold text-slate-700" dir="ltr">{range.dateFrom} — {range.dateTo}</span>
          )}
          {t.periodNote}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SideCard sd="receivables" />
        <SideCard sd="payables" />
      </div>

      {/* The chosen group's detail. */}
      <section
        id="ledger-detail"
        data-testid="ledger-rows"
        className="scroll-mt-6 overflow-hidden rounded-[22px] border border-hairline bg-surface"
      >
        <header className="flex flex-col gap-4 border-b border-hairline px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-bold text-brand-700">
              {t.sides[side].title} · {t.details}
            </p>
            <h3 className="font-heading mt-1 text-[22px] font-bold text-slate-900">{t.groups[group].title}</h3>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{t.groups[group].hint}</p>
          </div>
          {current?.states && (
            <nav
              data-testid="ledger-states"
              className="inline-flex shrink-0 flex-wrap items-center gap-1 rounded-full border border-hairline bg-surface-muted/60 p-1"
            >
              <SegLink href={href({ state: undefined, page: undefined })} active={!state}>
                {t.all} <span className="tabular-nums text-slate-500">{money(current.amount)}</span>
              </SegLink>
              {(Object.entries(current.states) as Array<[State, Fig]>).map(([k, f]) => (
                <SegLink key={k} href={href({ state: k, page: undefined })} active={state === k} title={t.statesHint[k]} testId={`ledger-state-${k}`}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[k])} />
                  {t.states[k]} <span className="tabular-nums text-slate-500">{money(f.amount)}</span>
                </SegLink>
              ))}
            </nav>
          )}
        </header>

        {!rows || rows.data.length === 0 ? (
          <p className="px-6 py-14 text-center text-[13px] text-slate-500">{rowsRes.error ?? t.empty}</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead className="bg-transparent">
                <tr className="border-b border-hairline text-[11.5px] font-semibold text-slate-500 [&>th]:bg-transparent [&>th]:text-slate-500">
                  <th className="px-6 py-3 text-start font-semibold">{t.cols.date}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.cols.item}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.cols.party}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.cols.ref}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.cols.unit}</th>
                  <th className="px-3 py-3 text-start font-semibold">{t.cols.state}</th>
                  <th className="px-6 py-3 text-end font-semibold">{t.cols.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.data.map((r) => (
                  <tr key={`${r.type}-${r.id}`} data-testid="ledger-row" className="transition-colors hover:bg-surface-muted/40">
                    <td className="whitespace-nowrap px-6 py-3.5 tabular-nums text-slate-600">{r.date ? formatDate(r.date, locale) : '—'}</td>
                    <td className="px-3 py-3.5">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="whitespace-nowrap font-semibold text-slate-800">{t.types[r.type] ?? r.type}</span>
                        {r.ref && (r.ref.kind === 'commission' || r.ref.kind === 'payout') && r.ref.code && (
                          <EntityLink kind={r.ref.kind} id={r.ref.id} className="whitespace-nowrap text-[12px] text-brand-700">{r.ref.code}</EntityLink>
                        )}
                      </span>
                      {r.payout && (
                        <span className="mt-0.5 block whitespace-nowrap text-[11.5px] text-slate-500">
                          {t.payout}{' '}
                          <EntityLink kind="payout" id={r.payout.id} className="text-brand-700">{r.payout.number ?? ''}</EntityLink>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {r.party ? (
                        <EntityLink
                          kind={r.party.kind === 'sales' ? 'client' : r.party.kind}
                          id={r.party.kind === 'sales' ? null : r.party.id}
                          mono={false}
                          className="font-semibold text-slate-800"
                        >
                          {r.party.name ?? '—'}
                        </EntityLink>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      {r.contract ? (
                        <EntityLink kind="contract" id={r.contract.id} className="whitespace-nowrap text-brand-700">{r.contract.number ?? '—'}</EntityLink>
                      ) : r.reservation ? (
                        <EntityLink kind="reservation" id={r.reservation.id} className="whitespace-nowrap text-brand-700">{r.reservation.number ?? '—'}</EntityLink>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      {r.unit ? <EntityLink kind="unit" id={r.unit.id} className="whitespace-nowrap text-slate-700">{r.unit.code}</EntityLink> : '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset', STATE_BADGE[r.state])}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[r.state])} />
                        {t.states[r.state]}
                        {r.state === 'late' && r.date && <span className="font-normal opacity-80">· {t.daysLate(daysSince(r.date))}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-end text-[14px] font-semibold tabular-nums text-slate-900">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows && rows.meta.total > pageSize && (
          <div className="border-t border-hairline px-4 py-3">
            <Pagination
              basePath="/dashboard/ledger"
              page={page}
              pageSize={pageSize}
              total={rows.meta.total}
              params={{ ...keep, group, state }}
              locale={locale}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/** One option of the detail's state switch. */
function SegLink({ href, active, children, title, testId }: {
  href: string; active: boolean; children: ReactNode; title?: string; testId?: string;
}) {
  return (
    <Link
      href={href as never}
      title={title}
      data-testid={testId}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors',
        active ? 'bg-surface text-slate-900 shadow-[0_2px_8px_-2px_rgb(20_26_38/0.18)]' : 'text-slate-600 hover:text-slate-900',
      )}
    >
      {children}
    </Link>
  );
}
