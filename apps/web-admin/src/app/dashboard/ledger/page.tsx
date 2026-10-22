import Link from 'next/link';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, PauseCircle, RotateCcw, Scale, Search } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { getCompanyTimeZone, getReportsCurrency, todayIn } from '@/lib/currency';
import { projectOptions as fetchProjectOptions } from '@/lib/options';
import type { Paged } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { PremiumFilterBar, PremiumFilterField, PremiumMetricStrip, PremiumPageHero } from '@/components/premium';
import { EntityLink } from '@/components/entity-link';
import { ledgerT } from './messages';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── API shapes (GET /reports/ledger, /reports/ledger/rows) ───────────────────
type Fig = { amount: string; count: number };
type State = 'late' | 'dueToday' | 'upcoming' | 'onItsWay' | 'pendingApproval';
interface LedgerSummary {
  asOf: string;
  receivables: {
    total: string;
    groups: {
      installments: Fig & { states: Record<'late' | 'dueToday' | 'upcoming' | 'onItsWay', Fig>; types: Record<string, Fig> };
      bookings: Fig & { states: Record<'late' | 'onItsWay', Fig> };
      fees: Fig & { states: Record<'late' | 'dueToday' | 'upcoming' | 'onItsWay', Fig> };
      clawbacks: Fig;
    };
  };
  payables: {
    total: string;
    groups: {
      commissions: Fig & { states: Record<'late' | 'pendingApproval', Fig> };
      topUps: Fig;
      bonuses: Fig & { states: Record<'late' | 'pendingApproval', Fig> };
      refunds: Fig;
    };
    onHold: Fig;
  };
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

type Tab = 'receivables' | 'payables';
type Group = 'installments' | 'bookings' | 'fees' | 'clawbacks' | 'commissions' | 'topUps' | 'bonuses' | 'refunds' | 'onHold';
const GROUPS: Record<Tab, Group[]> = {
  receivables: ['installments', 'bookings', 'fees', 'clawbacks'],
  payables: ['commissions', 'bonuses', 'topUps', 'refunds', 'onHold'],
};
const PERIODS = ['all', 'thisMonth', 'nextMonth', 'quarter', 'year', 'custom'] as const;
type Period = (typeof PERIODS)[number];

interface Search {
  tab?: string; group?: string; state?: string; page?: string;
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

const STATE_STYLE: Record<State, string> = {
  late: 'bg-danger-50 text-danger-700 border-danger-100',
  dueToday: 'bg-warning-50 text-warning-700 border-warning-100',
  upcoming: 'bg-surface-muted text-slate-600 border-hairline',
  onItsWay: 'bg-brand-50 text-brand-700 border-brand-400/30',
  pendingApproval: 'bg-surface-muted text-slate-600 border-hairline',
};

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = ledgerT(locale);
  const [currency, tz] = await Promise.all([getReportsCurrency(), getCompanyTimeZone()]);
  const today = todayIn(tz);
  const money = (v: string | number) => formatCurrency(v, currency, locale);

  const tab: Tab = sp.tab === 'payables' ? 'payables' : 'receivables';
  // Dates typed without picking a preset are a custom range.
  const picked: Period = (PERIODS as readonly string[]).includes(sp.period ?? '') ? (sp.period as Period) : 'all';
  const period: Period = picked === 'all' && (sp.dateFrom || sp.dateTo) ? 'custom' : picked;
  const range = periodRange(period, today, sp);
  const group: Group = GROUPS[tab].includes(sp.group as Group) ? (sp.group as Group) : GROUPS[tab][0]!;
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

  // Links keep the filters; switching tab or group starts the rows over.
  const keep = { period: period === 'all' ? undefined : period, dateFrom: sp.dateFrom, dateTo: sp.dateTo, projectId: sp.projectId, q: sp.q };
  const href = (over: Partial<Search>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, tab, group, ...over })) if (v) qs.set(k, String(v));
    return `/dashboard/ledger?${qs.toString()}`;
  };

  const lateReceivable = s
    ? Number(s.receivables.groups.installments.states.late.amount) +
      Number(s.receivables.groups.bookings.states.late.amount) +
      Number(s.receivables.groups.fees.states.late.amount) +
      Number(s.receivables.groups.clawbacks.amount)
    : 0;
  const latePayable = s
    ? Number(s.payables.groups.commissions.states.late.amount) +
      Number(s.payables.groups.bonuses.states.late.amount) +
      Number(s.payables.groups.topUps.amount) +
      Number(s.payables.groups.refunds.amount)
    : 0;

  const groupFig = (g: Group): (Fig & { states?: Partial<Record<State, Fig>> }) | null => {
    if (!s) return null;
    if (g === 'onHold') return s.payables.onHold;
    return tab === 'receivables'
      ? (s.receivables.groups as Record<string, Fig & { states?: Partial<Record<State, Fig>> }>)[g] ?? null
      : (s.payables.groups as Record<string, Fig & { states?: Partial<Record<State, Fig>> }>)[g] ?? null;
  };
  const current = groupFig(group);
  const daysSince = (d: string) =>
    Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.slice(0, 10)}T00:00:00Z`)) / 86_400_000));

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[{ label: t.home, href: '/dashboard' }, { label: t.breadcrumb }]}
      >
        {s && (
          <PremiumMetricStrip
            cols={5}
            metrics={[
              { label: t.metrics.receivables, value: money(s.receivables.total), icon: <ArrowDownLeft /> },
              { label: t.metrics.receivablesLate, value: money(lateReceivable), icon: <AlertTriangle /> },
              { label: t.metrics.payables, value: money(s.payables.total), icon: <ArrowUpRight /> },
              { label: t.metrics.payablesLate, value: money(latePayable), icon: <AlertTriangle /> },
              {
                label: t.metrics.net,
                value: money(s.net),
                icon: <Scale />,
                sub: `${t.metrics.asOf} ${formatDate(s.asOf, locale)}`,
              },
            ]}
          />
        )}
      </PremiumPageHero>

      <PremiumFilterBar method="get" action="/dashboard/ledger" data-testid="ledger-filters">
        <input type="hidden" name="tab" value={tab} />
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
        <div className="min-w-[180px] flex-1">
          <label htmlFor="lg-q" className="sr-only">{t.filter.search}</label>
          <Input id="lg-q" name="q" inputSize="sm" placeholder={t.filter.search} defaultValue={sp.q ?? ''} leftAddon={<Search />} className="w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" variant="primary" size="sm">{t.filter.apply}</Button>
          {(period !== 'all' || sp.projectId || sp.q) && (
            <Link
              href={`/dashboard/ledger?tab=${tab}` as never}
              title={t.filter.reset}
              aria-label={t.filter.reset}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-danger-500/40 hover:text-danger-600"
            >
              <RotateCcw className="h-4 w-4" />
            </Link>
          )}
        </div>
      </PremiumFilterBar>
      <p className="-mt-2 px-2 text-[12px] text-slate-500">
        {period === 'custom' || period === 'all' ? null : `${range.dateFrom} → ${range.dateTo} · `}
        {t.periodNote}
      </p>

      {/* Tabs: ليا / عليا with their totals */}
      <div className="flex gap-8 border-b border-hairline" role="tablist">
        {(['receivables', 'payables'] as const).map((k) => (
          <Link
            key={k}
            href={href({ tab: k, group: GROUPS[k][0], state: undefined, page: undefined }) as never}
            role="tab"
            aria-selected={tab === k}
            data-testid={`ledger-tab-${k}`}
            className={cn(
              'font-heading -mb-px border-b-2 pb-3 text-[17px] font-bold transition-colors duration-150',
              tab === k ? 'border-[#C79A3B] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {t.tabs[k]}
            {s && (
              <span className="ms-2 text-[14px] font-semibold tabular-nums text-slate-500">
                {money(k === 'receivables' ? s.receivables.total : s.payables.total)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Groups of the tab */}
      <div className={cn('grid gap-3', tab === 'receivables' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-5')}>
        {GROUPS[tab].map((g) => {
          const fig = groupFig(g);
          const active = g === group;
          return (
            <Link
              key={g}
              href={href({ group: g, state: undefined, page: undefined }) as never}
              aria-current={active ? 'true' : undefined}
              data-testid={`ledger-group-${g}`}
              className={cn(
                'rounded-2xl border px-4 py-3.5 transition-colors',
                g === 'onHold' && 'border-dashed',
                active
                  ? 'border-brand-500/50 bg-gradient-to-br from-brand-500/[0.14] to-brand-700/[0.04]'
                  : 'border-hairline bg-surface hover:border-brand-500/30',
              )}
            >
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600">
                {g === 'onHold' && <PauseCircle className="h-3.5 w-3.5 text-slate-400" />}
                {t.groups[g].title}
              </span>
              <span className={cn('mt-1.5 block text-[22px] font-bold leading-none tabular-nums', active ? 'text-brand-700' : 'text-slate-900')}>
                {fig ? money(fig.amount) : '—'}
              </span>
              <span className="mt-1.5 block text-[11.5px] text-slate-500">
                {fig ? t.count(fig.count) : ''}
                {g === 'onHold' && ` · ${t.onHoldNote}`}
              </span>
            </Link>
          );
        })}
      </div>

      {/* The selected group: its states, then its rows */}
      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface" data-testid="ledger-rows">
        <header className="flex flex-col gap-3 border-b border-hairline px-6 py-4">
          <div>
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{t.groups[group].title}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">{t.groups[group].hint}</p>
          </div>
          {current?.states && (
            <div className="flex flex-wrap gap-2" data-testid="ledger-states">
              <Link
                href={href({ state: undefined, page: undefined }) as never}
                className={cn('rounded-full border px-3 py-1 text-[12px] font-semibold', !state ? 'border-brand-500/50 bg-brand-50 text-brand-700' : 'border-hairline text-slate-600 hover:border-brand-500/30')}
              >
                {t.all} · {money(current.amount)}
              </Link>
              {(Object.entries(current.states) as Array<[State, Fig]>).map(([k, f]) => (
                <Link
                  key={k}
                  href={href({ state: k, page: undefined }) as never}
                  title={k === 'onItsWay' ? t.statesHint.onItsWay : undefined}
                  data-testid={`ledger-state-${k}`}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12px] font-semibold tabular-nums',
                    state === k ? 'border-brand-500/50 bg-brand-50 text-brand-700' : STATE_STYLE[k],
                  )}
                >
                  {t.states[k]} · {money(f.amount)} ({f.count})
                </Link>
              ))}
            </div>
          )}
        </header>

        {!rows || rows.data.length === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-slate-500">{rowsRes.error ?? t.empty}</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-start text-[11.5px] font-semibold text-slate-500">
                  <th className="px-6 py-3 text-start">{t.cols.date}</th>
                  <th className="px-3 py-3 text-start">{t.cols.item}</th>
                  <th className="px-3 py-3 text-start">{t.cols.party}</th>
                  <th className="px-3 py-3 text-start">{t.cols.ref}</th>
                  <th className="px-3 py-3 text-start">{t.cols.unit}</th>
                  <th className="px-3 py-3 text-start">{t.cols.state}</th>
                  <th className="px-6 py-3 text-end">{t.cols.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.data.map((r) => (
                  <tr key={`${r.type}-${r.id}`} data-testid="ledger-row" className="transition-colors hover:bg-surface-muted/30">
                    <td className="whitespace-nowrap px-6 py-3 tabular-nums text-slate-700">{r.date ? formatDate(r.date, locale) : '—'}</td>
                    <td className="px-3 py-3">
                      <span className="whitespace-nowrap font-semibold text-slate-800">{t.types[r.type] ?? r.type}</span>
                      {r.ref && (r.ref.kind === 'commission' || r.ref.kind === 'payout') && r.ref.code && (
                        <EntityLink kind={r.ref.kind} id={r.ref.id} className="ms-2 whitespace-nowrap text-[12px] text-brand-700">{r.ref.code}</EntityLink>
                      )}
                      {r.payout && (
                        <span className="mt-0.5 block whitespace-nowrap text-[11.5px] text-slate-500">
                          {t.payout}{' '}
                          <EntityLink kind="payout" id={r.payout.id} className="text-brand-700">{r.payout.number ?? ''}</EntityLink>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
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
                    <td className="px-3 py-3">
                      {r.contract ? (
                        <EntityLink kind="contract" id={r.contract.id} className="whitespace-nowrap text-brand-700">{r.contract.number ?? '—'}</EntityLink>
                      ) : r.reservation ? (
                        <EntityLink kind="reservation" id={r.reservation.id} className="whitespace-nowrap text-brand-700">{r.reservation.number ?? '—'}</EntityLink>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      {r.unit ? <EntityLink kind="unit" id={r.unit.id} className="whitespace-nowrap">{r.unit.code}</EntityLink> : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', STATE_STYLE[r.state])}>
                        {t.states[r.state]}
                        {r.state === 'late' && r.date && <span className="ms-1 font-normal">{t.daysLate(daysSince(r.date))}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-end font-semibold tabular-nums text-slate-900">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows && (
          <div className="border-t border-hairline px-4 py-3">
            <Pagination
              basePath="/dashboard/ledger"
              page={page}
              pageSize={pageSize}
              total={rows.meta.total}
              params={{ ...keep, tab, group, state }}
              locale={locale}
            />
          </div>
        )}
      </section>
    </div>
  );
}
