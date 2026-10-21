import { AlertCircle, Wallet } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { compactParts, formatDate } from '@/lib/format';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { attainment, expectedPct, STATUS_BAR, STATUS_CHIP, targetPhase, targetStatus } from '@/lib/target-pace';
import { PremiumPageHero } from '@/components/premium';
import { Amount, FigureBar, PaceBar, Panel } from '@/components/cockpit/cockpit';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────

type EntryStatus = 'PENDING' | 'APPROVED' | 'PAID';
type EntrySource = 'MANUAL' | 'CONTRACT_AUTO';

interface BonusEntry {
  id: string;
  amount: string | number;
  period: string;
  status: EntryStatus;
  paidAt: string | null;
  createdAt?: string;
  source?: EntrySource;
  rule?: { name: string };
}

interface SalesTarget {
  id: string;
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
}
interface PerformanceRow {
  salesId: string;
  period: string;
  openLeadsCount: number;
  upcomingVisitsCount: number;
  activeReservationsCount: number;
  signedContractsCount: number;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

const ENTRY_TONE: Record<EntryStatus, { bar: string; dot: string; chip: string }> = {
  PENDING:  { bar: 'bg-amber-400',   dot: 'bg-amber-400',   chip: 'bg-amber-500/12 text-amber-600' },
  APPROVED: { bar: 'bg-sky-400',     dot: 'bg-sky-400',     chip: 'bg-sky-500/12 text-sky-600' },
  PAID:     { bar: 'bg-emerald-400', dot: 'bg-emerald-400', chip: 'bg-emerald-500/12 text-emerald-600' },
};

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="mx-6 mb-6 flex items-start gap-2 rounded-2xl bg-warning-500/10 p-4 text-sm text-warning-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{msg}</p>
    </div>
  );
}

/**
 * A rep's own page: this month's target with its pace beside what the rep
 * has earned, then the earnings one per line and every month's target.
 */
/** Earnings listed before "show all". */
const ENTRIES_SHOWN = 6;

export default async function MyCompensationPage({ searchParams }: { searchParams: Promise<{ entries?: string }> }) {
  const showAll = (await searchParams).entries === 'all';
  const [session, locale, currency, timeZone] = await Promise.all([
    getSession(), getLocale(), getReportsCurrency(), getCompanyTimeZone(),
  ]);
  const t = uiT(locale);
  const m = t.myCompensationPage;
  const symbol = currencySymbol(currency, locale);
  const today = todayIn(timeZone);
  const currentPeriod = today.slice(0, 7);

  const nowIso = new Date().toISOString();
  const selfId = session?.id;
  const selfParam = selfId ? `salesId=${selfId}` : '';

  const [bonusRes, targetsRes, leadsRes, reservationsRes, visitsRes] = await Promise.all([
    safe(api.get<BonusEntry[] | Paged<BonusEntry>>(`/bonus-entries${selfParam ? `?${selfParam}` : ''}`)),
    safe(api.get<SalesTarget[]>(`/sales-targets${selfParam ? `?${selfParam}` : ''}`)),
    // Only the facets are read, so one row is enough.
    safe(api.get<Paged<Lead>>(`/leads?pageSize=1${selfParam ? `&${selfParam}` : ''}`)),
    safe(api.get<Paged<Reservation>>(`/reservations?pageSize=1${selfParam ? `&${selfParam}` : ''}`)),
    selfId
      ? safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?assignedSalesId=${selfId}&scheduledFrom=${nowIso}&open=true&pageSize=1`))
      : Promise.resolve({ data: undefined, error: m.noSession as string }),
  ]);

  const periodLabel = (period: string) => {
    const [y, mo] = period.split('-');
    return `${m.months[parseInt(mo ?? '0', 10) - 1] ?? period} ${y}`;
  };
  const planName = (name: string | null | undefined, source: EntrySource | undefined) => {
    if (source === 'MANUAL') return m.planManual;
    if (!name || /\b(test|temp|debug|draft|sample|example)\b/i.test(name)) return m.planDefault;
    return name;
  };
  const money = (n: number | string) => compactParts(n, symbol, locale).join(' ');

  const entries = Array.isArray(bonusRes.data) ? bonusRes.data : (bonusRes.data?.data ?? []);
  const targets = [...(targetsRes.data ?? [])].sort((a, b) => b.period.localeCompare(a.period));
  const leadStages = leadsRes.data?.meta.facets?.counts?.stage ?? {};
  const resvStatus = reservationsRes.data?.meta.facets?.counts?.status ?? {};

  const perfPeriods = [...new Set([currentPeriod, ...targets.map((x) => x.period)])];
  const perfResults = await Promise.all(
    perfPeriods.map((p) => safe(api.get<PerformanceRow[]>(`/sales-targets/performance?period=${p}${selfParam ? `&${selfParam}` : ''}`))),
  );
  const perfByPeriod = new Map<string, PerformanceRow>();
  perfResults.forEach((r, i) => {
    const row = (r.data ?? [])[0];
    if (row) perfByPeriod.set(perfPeriods[i]!, row);
  });
  const perf = perfByPeriod.get(currentPeriod);
  const target = targets.find((x) => x.period === currentPeriod);

  // ── Earnings ──
  const sum = (s: EntryStatus) => entries.filter((e) => e.status === s).reduce((a, e) => a + Number(e.amount || 0), 0);
  const totals: Record<EntryStatus, number> = { PENDING: sum('PENDING'), APPROVED: sum('APPROVED'), PAID: sum('PAID') };
  const owed = totals.PENDING + totals.APPROVED;
  const all = owed + totals.PAID;
  const lastPaidAt = entries.filter((e) => e.status === 'PAID' && e.paidAt).map((e) => e.paidAt as string).sort().at(-1);

  // ── This month ──
  const amtPct = perf?.targetAmountPercent ?? null;
  const unitPct = perf?.targetUnitsPercent ?? null;
  const att = attainment(amtPct, unitPct);
  const status = target ? targetStatus(att, currentPeriod, today) : 'none';
  const expected = expectedPct(currentPeriod, today);
  const [y, mo] = currentPeriod.split('-').map(Number) as [number, number];
  const daysLeft = new Date(Date.UTC(y, mo, 0)).getUTCDate() - Number(today.slice(8, 10));

  const openLeads = perf?.openLeadsCount ?? (leadsRes.data?.meta.total ?? 0) - (leadStages.WON ?? 0) - (leadStages.LOST ?? 0);
  const upcomingVisits = perf?.upcomingVisitsCount ?? visitsRes.data?.meta.total ?? 0;
  const activeReservations = perf?.activeReservationsCount ?? (resvStatus.PENDING ?? 0) + (resvStatus.APPROVED ?? 0);

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.title}
        description={session?.role === 'SALES_MANAGER' ? m.descriptionManager : m.descriptionStaff}
        breadcrumbs={[{ label: m.breadcrumbDashboard, href: '/dashboard' }, { label: m.breadcrumbSelf }]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5 xl:items-stretch">
        {/* This month's target, its pace and the month's activity */}
        <section data-testid="month-target" className="flex flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface xl:col-span-3">
          <div className="flex-1 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-[#B8913F] dark:text-[#D8B66A]">{m.monthTarget} · {periodLabel(currentPeriod)}</p>
              {target && (
                <span data-testid="month-status" className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold', STATUS_CHIP[status])}>
                  {t.common.targetStatus[status]}
                </span>
              )}
            </div>
            {target ? (
              <>
                <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
                  <p className="font-heading text-[56px] font-bold leading-none tabular-nums text-slate-900">
                    {att === null ? '—' : `${att > 999 ? '+999' : att}%`}
                  </p>
                  <div className="pb-1.5 text-[13px] text-slate-500">
                    <p className="font-semibold text-slate-700">{m.ofTarget(money(perf?.achievedAmount ?? 0), money(target.amountTarget))}</p>
                    <p>{m.unitsOf(perf?.achievedUnits ?? 0, target.unitsTarget)}</p>
                  </div>
                </div>
                <PaceBar className="mt-5" pct={att} expected={expected} tone={STATUS_BAR[status]} />
                <div className="mt-2 flex justify-between text-[12px] text-slate-500">
                  <span>{t.common.targetExpected(expected)}</span>
                  <span>{m.daysLeft(daysLeft)}</span>
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{m.noMonthTarget}</p>
            )}
          </div>
          <div className="border-t border-hairline">
            <FigureBar
              bare
              cols={4}
              figures={[
                { label: m.activityOpenLeads, value: openLeads, href: '/dashboard/leads' },
                { label: m.activityUpcomingVisits, value: upcomingVisits, href: '/dashboard/visits?tab=appointments' },
                { label: m.activityActiveReservations, value: activeReservations, href: '/dashboard/reservations' },
                { label: m.perfClosedContractsLabel, value: perf?.signedContractsCount ?? 0, href: '/dashboard/contracts' },
              ]}
            />
          </div>
        </section>

        {/* What the rep has earned */}
        <section data-testid="earnings" className="flex flex-col rounded-[22px] border border-hairline bg-surface p-6 sm:p-7 xl:col-span-2">
          <p className="text-[13px] font-bold text-[#B8913F] dark:text-[#D8B66A]">{m.earningsTitle}</p>
          {bonusRes.error ? (
            <div className="mt-4"><SectionError msg={m.errorSection} /></div>
          ) : (
            <>
              <p className="mt-4 text-[12.5px] font-semibold text-slate-500">{m.owedLabel}</p>
              <p className="mt-1 font-heading text-[44px] font-bold leading-none tabular-nums text-slate-900">
                <Amount parts={compactParts(owed, symbol, locale)} />
              </p>
              <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-500/15" dir="ltr">
                {all > 0 && (['PAID', 'APPROVED', 'PENDING'] as const).filter((s) => totals[s] > 0).map((s) => (
                  <span key={s} className={cn('h-full', ENTRY_TONE[s].bar)} style={{ width: `${(totals[s] / all) * 100}%` }} />
                ))}
              </div>
              <dl className="mt-4 space-y-2.5">
                {(['PENDING', 'APPROVED', 'PAID'] as const).map((s) => (
                  <div key={s} className="flex items-center justify-between gap-3 text-[13px]">
                    <dt className="flex items-center gap-2 text-slate-600">
                      <span className={cn('h-2 w-2 rounded-full', ENTRY_TONE[s].dot)} />
                      {m.statusLabels[s]}
                    </dt>
                    <dd className="font-bold tabular-nums text-slate-900">{money(totals[s])}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-auto pt-5 text-[12px] text-slate-500">
                {all === 0 ? m.noEarnings : lastPaidAt ? m.lastPaid(formatDate(lastPaidAt, locale)) : m.kpiPaidSubNone}
              </p>
            </>
          )}
        </section>
      </div>

      {/* Earnings, one per line */}
      {entries.length > 0 && (
        <Panel
          testId="entries"
          title={m.entriesSectionTitle}
          sub={m.entriesCountSuffix(entries.length)}
          link={entries.length > ENTRIES_SHOWN
            ? showAll
              ? { href: '/dashboard/my-compensation', label: m.showLess }
              : { href: '/dashboard/my-compensation?entries=all', label: m.showAll(entries.length) }
            : undefined}
        >
          <ul className="divide-y divide-hairline border-t border-hairline">
            {(showAll ? entries : entries.slice(0, ENTRIES_SHOWN)).map((e) => (
              <li key={e.id} data-testid="entry" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3.5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D8B66A]/[0.14] text-[#B8913F] dark:text-[#D8B66A]">
                  <Wallet className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-[14px] font-bold text-slate-900">{planName(e.rule?.name, e.source)}</p>
                  <p className="text-[12px] text-slate-500">
                    {periodLabel(e.period)} · {m.sourceLabels[e.source ?? 'MANUAL']}
                    {e.paidAt ? ` · ${m.lastPaid(formatDate(e.paidAt, locale))}` : ''}
                  </p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-bold', ENTRY_TONE[e.status].chip)}>{m.statusLabels[e.status]}</span>
                <span className="w-32 whitespace-nowrap text-end text-[15px] font-bold tabular-nums text-slate-900">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Every month against its target */}
      <Panel testId="target-history" title={m.historyTitle} sub={m.historySub}>
        {targetsRes.error ? (
          <SectionError msg={m.errorSection} />
        ) : targets.length === 0 ? (
          <p className="mx-6 mb-6 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">{m.targetsEmpty}</p>
        ) : (
          <>
            <ul className="divide-y divide-hairline border-t border-hairline">
              {targets.map((x) => {
                const p = perfByPeriod.get(x.period);
                const a = p?.targetAmountPercent ?? null;
                const u = p?.targetUnitsPercent ?? null;
                const st = targetStatus(attainment(a, u), x.period, today);
                const exp = targetPhase(x.period, today) === 'current' ? expectedPct(x.period, today) : null;
                return (
                  <li key={x.id} data-testid="target-month" className="grid grid-cols-1 items-center gap-4 px-6 py-4 md:grid-cols-[150px_1fr_1fr_auto]">
                    <p className="text-[14px] font-bold text-slate-900">{periodLabel(x.period)}</p>
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-slate-500">{m.valueLabel}</span>
                        <span className="tabular-nums text-slate-600">
                          <b className="font-bold text-slate-900">{a === null ? '—' : `${a > 999 ? '+999' : a}%`}</b>
                          {' · '}{m.ofTarget(money(p?.achievedAmount ?? 0), money(x.amountTarget))}
                        </span>
                      </div>
                      <PaceBar className="mt-2" pct={a} expected={exp} tone={STATUS_BAR[st]} />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-slate-500">{m.unitsLabel}</span>
                        <span className="tabular-nums text-slate-600">
                          <b className="font-bold text-slate-900">{u === null ? '—' : `${u > 999 ? '+999' : u}%`}</b>
                          {' · '}{p?.achievedUnits ?? 0} / {x.unitsTarget}
                        </span>
                      </div>
                      <PaceBar className="mt-2" pct={u} expected={exp} tone={STATUS_BAR[st]} />
                    </div>
                    <span data-testid="target-status" className={cn('justify-self-start rounded-full px-2.5 py-1 text-[11.5px] font-bold md:justify-self-end', STATUS_CHIP[st])}>
                      {t.common.targetStatus[st]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-hairline px-6 py-3 text-[12px] text-slate-500">{m.targetsNote}</p>
          </>
        )}
      </Panel>
    </div>
  );
}
