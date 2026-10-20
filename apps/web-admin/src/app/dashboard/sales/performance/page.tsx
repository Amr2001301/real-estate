import Link from 'next/link';
import {
  BadgePercent,
  CalendarDays,
  FileText,
  Settings2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import { formatCurrency, intlLocale } from '@/lib/format';
import { getReportsCurrency, getCompanyTimeZone, todayIn } from '@/lib/currency';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { PremiumPageHero, PremiumPanel, PremiumEmptyNote, PremiumFilterBar, PremiumFilterField } from '@/components/premium';
import { TargetBar } from '@/components/sales/target-bar';
import { attainment, expectedPct, STATUS_CHIP, targetPhase, targetStatus } from '@/lib/target-pace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Search {
  period?: string;
  salesId?: string;
}

interface PerformanceRow {
  salesId: string;
  salesName: string;
  period: string;
  leadsCount: number;
  openLeadsCount: number;
  visitsCount: number;
  upcomingVisitsCount: number;
  reservationsCount: number;
  activeReservationsCount: number;
  convertedReservationsCount: number;
  signedContractsCount: number;
  realizedValue: number;
  targetAmount: number | null;
  targetUnits: number | null;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

interface BonusEntry {
  id: string;
  salesId: string;
  amount: string;
  period: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  source: 'MANUAL' | 'CONTRACT_AUTO' | 'ADJUSTMENT';
  basisAmount?: string | null;
  commissionPct?: string | null;
  sales?: { id: string; fullName: string } | null;
  rule?: { id: string; name: string } | null;
}

interface SalesActor {
  id: string;
  fullName: string;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// The company's month (its time zone), not UTC's.
async function currentPeriod(): Promise<string> {
  return todayIn(await getCompanyTimeZone()).slice(0, 7);
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const locale = await getLocale();
  const m = uiT(locale).salesPerformancePage;

  const sp     = await searchParams;
  const currency = await getReportsCurrency();
  const period = sp.period ?? (await currentPeriod());

  const [y, mo] = period.split('-');
  const periodStr = `${m.months[parseInt(mo ?? '1', 10) - 1] ?? mo} ${y}`;

  const perfQs  = new URLSearchParams({ period });
  const bonusQs = new URLSearchParams({ period });
  if (sp.salesId) { perfQs.set('salesId', sp.salesId); bonusQs.set('salesId', sp.salesId); }

  const [perfRes, bonusRes, actorsRes] = await Promise.all([
    safe(api.get<PerformanceRow[]>(`/sales-targets/performance?${perfQs}`)),
    safe(api.get<BonusEntry[]>(`/bonus-entries?${bonusQs}`)),
    safe(api.get<SalesActor[]>('/sales-targets/actors')),
  ]);

  const rows   = perfRes.data   ?? [];
  const bonus  = bonusRes.data  ?? [];
  const actors = actorsRes.data ?? [];

  const tz = await getCompanyTimeZone();
  const today = todayIn(tz);
  const ts = uiT(locale).common;
  const phase = targetPhase(period, today);
  const expected = phase === 'current' ? expectedPct(period, today) : null;

  // ── Derived ───────────────────────────────────────────────────────────────
  const scored = rows.map((r) => {
    const att = attainment(r.targetAmountPercent, r.targetUnitsPercent);
    return { ...r, att, status: targetStatus(att, period, today) };
  });
  const withTarget = scored.filter((r) => r.att !== null);
  const totalAchieved  = rows.reduce((s, r) => s + r.achievedAmount, 0);
  const totalContracts = rows.reduce((s, r) => s + r.signedContractsCount, 0);
  const totalLeads     = rows.reduce((s, r) => s + r.leadsCount, 0);
  const totalVisits    = rows.reduce((s, r) => s + r.visitsCount, 0);
  const totalRes       = rows.reduce((s, r) => s + r.reservationsCount, 0);
  const totalOpenLeads = rows.reduce((s, r) => s + r.openLeadsCount, 0);
  const totalUpcoming  = rows.reduce((s, r) => s + r.upcomingVisitsCount, 0);
  const totalActiveRes = rows.reduce((s, r) => s + r.activeReservationsCount, 0);
  const totalConvRes   = rows.reduce((s, r) => s + r.convertedReservationsCount, 0);
  const totalBonusAmt  = bonus.reduce((s, b) => s + Number(b.amount), 0);
  const teamAmountTarget = rows.reduce((s, r) => s + (r.targetAmount ?? 0), 0);
  const teamUnitsTarget = rows.reduce((s, r) => s + (r.targetUnits ?? 0), 0);
  const teamUnits = rows.reduce((s, r) => s + r.achievedUnits, 0);

  const avgAttainment = withTarget.length > 0
    ? Math.round(withTarget.reduce((s, r) => s + (r.att ?? 0), 0) / withTarget.length)
    : null;
  const teamStatus = targetStatus(avgAttainment, period, today);

  // Pipeline flow — monotonically non-increasing widths (% of first stage)
  const pipelineFlow = (() => {
    const stages = [
      { label: m.pipelineStageOpenLeads,          value: totalOpenLeads, bar: 'bg-sky-500',     dot: 'bg-sky-500' },
      { label: m.pipelineStageUpcomingVisits,     value: totalUpcoming,  bar: 'bg-violet-500',  dot: 'bg-violet-500' },
      { label: m.pipelineStageActiveReservations, value: totalActiveRes, bar: 'bg-amber-500',   dot: 'bg-amber-500' },
      { label: m.pipelineStageConverted,          value: totalConvRes,   bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    ];
    const first = stages[0]?.value ?? 1;
    let prevW = 100;
    return stages.map((st, i) => {
      const nat    = first > 0 ? (st.value / first) * 100 : 0;
      const capped = Math.min(nat, prevW);
      prevW = capped;
      const w    = Math.max(capped, st.value > 0 ? 5 : 0);
      const prev = stages[i - 1]?.value ?? 0;
      const conv = i > 0 && prev > 0 ? st.value / prev : null;
      return { ...st, pct: w, conv };
    });
  })();
  const pipelineOverallConv = totalOpenLeads > 0 ? totalConvRes / totalOpenLeads : null;

  const sorted = [...scored].sort((a, b) => {
    if ((a.att !== null) !== (b.att !== null)) return a.att !== null ? -1 : 1;
    if (a.att !== null && b.att !== null) return b.att - a.att;
    return b.achievedAmount - a.achievedAmount;
  });

  const hasFilter = !!(sp.period || sp.salesId);
  const ringPct = Math.min(avgAttainment ?? 0, 100);
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.title}
        description={m.description(periodStr)}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbSales },
          { label: m.breadcrumbSelf },
        ]}
        actions={
          <Link href="/dashboard/targets">
            <Button variant="outline" size="sm" leftIcon={<Settings2 className="h-4 w-4" />}>
              {m.manageTargetsBtn}
            </Button>
          </Link>
        }
      />

      <PremiumFilterBar
        method="get"
        action="/dashboard/sales/performance"
        trailing={
          <>
            <Button type="submit" variant="primary" size="sm">{m.filterApplyBtn}</Button>
            {hasFilter && (
              <Link href="/dashboard/sales/performance">
                <Button type="button" variant="ghost" size="sm">{m.filterClearBtn}</Button>
              </Link>
            )}
          </>
        }
      >
        <PremiumFilterField label={m.filterPeriodLabel} htmlFor="period">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <Input id="period" name="period" inputSize="sm" type="month" defaultValue={period} className="w-40" />
          </div>
        </PremiumFilterField>
        <PremiumFilterField label={m.filterSalesLabel} htmlFor="salesId">
          <Select id="salesId" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-52">
            <option value="">{m.filterAllSales}</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ── Team overview ─────────────────────────────────────────────── */}
      <div data-testid="team-overview" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-[22px] border border-hairline bg-surface p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.10] via-transparent to-transparent" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative h-[124px] w-[124px] shrink-0">
              <svg viewBox="0 0 124 124" className="h-full w-full -rotate-90">
                <circle cx="62" cy="62" r={R} fill="none" strokeWidth="10" className="stroke-surface-muted" />
                <circle
                  cx="62" cy="62" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(ringPct / 100) * C} ${C}`}
                  opacity={ringPct > 0 ? 1 : 0}
                  className={cn(teamStatus === 'behind' ? 'stroke-amber-500' : teamStatus === 'missed' ? 'stroke-danger-500' : teamStatus === 'achieved' ? 'stroke-emerald-500' : 'stroke-brand-500')}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="num text-[34px] font-semibold leading-none text-slate-900">
                  {avgAttainment !== null ? `${avgAttainment}%` : '—'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">{ts.targetAttainment}</span>
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-[19px] font-bold text-slate-900">{m.kpiAvgAttainment}</h2>
                <span data-testid="team-status" className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', STATUS_CHIP[teamStatus])}>
                  {ts.targetStatus[teamStatus]}
                </span>
              </div>
              {withTarget.length > 0 ? (
                <>
                  <TargetBar
                    label={ts.targetValue}
                    pct={teamAmountTarget > 0 ? Math.round((totalAchieved / teamAmountTarget) * 100) : null}
                    expected={expected}
                    status={teamStatus}
                    figure={<>{formatCurrency(totalAchieved, currency, locale)} / {formatCurrency(teamAmountTarget, currency, locale)}</>}
                  />
                  <TargetBar
                    label={ts.targetUnits}
                    pct={teamUnitsTarget > 0 ? Math.round((teamUnits / teamUnitsTarget) * 100) : null}
                    expected={expected}
                    status={teamStatus}
                    figure={<>{teamUnits} / {teamUnitsTarget}</>}
                  />
                  <p className="text-[12px] text-slate-500">
                    {ts.targetAttainmentHint}
                    {expected !== null && <> · <span className="font-semibold text-slate-700">{ts.targetExpected(expected)}</span></>}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-slate-500">{m.kpiAvgNoTargets}</p>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 overflow-hidden rounded-[22px] border border-hairline bg-surface sm:grid-cols-3 xl:grid-cols-1">
          {[
            { label: m.kpiTotalSales, value: formatCurrency(totalAchieved, currency, locale), sub: m.kpiTotalSalesSub(rows.length), icon: <Wallet /> },
            { label: m.kpiContracts, value: String(totalContracts), sub: m.kpiContractsSub(totalLeads), icon: <FileText /> },
            { label: m.kpiBonus, value: formatCurrency(totalBonusAmt, currency, locale), sub: m.kpiBonusSub(bonus.length), icon: <BadgePercent /> },
          ].map((k, i) => (
            <div key={k.label} className={cn('flex items-center gap-4 px-5 py-4', i > 0 && 'border-hairline max-xl:sm:border-s xl:border-t max-sm:border-t')}>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                {k.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-500">{k.label}</p>
                <p className="num truncate text-[24px] font-semibold leading-tight text-slate-900">{k.value}</p>
                <p className="truncate text-[11.5px] text-slate-500">{k.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Reps ──────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <PremiumPanel title={m.tableTitle}>
          <PremiumEmptyNote>
            <span className="block font-semibold text-slate-700">{m.emptyTitle}</span>
            {m.emptyDesc}
          </PremiumEmptyNote>
        </PremiumPanel>
      ) : (
        <PremiumPanel title={m.tableTitle} sub={m.tableDesc(rows.length, periodStr)} padding="none">
          <ul data-testid="rep-performance" className="divide-y divide-hairline border-t border-hairline">
            {sorted.map((row, idx) => (
              <li key={row.salesId} className="grid grid-cols-1 items-center gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className={cn(
                    'num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold',
                    idx === 0 && row.att !== null ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408]' : 'bg-surface-muted text-slate-500',
                  )}>
                    {idx + 1}
                  </span>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[16px] font-bold text-brand-700 ring-1 ring-brand-500/40">
                    {row.salesName.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-bold text-slate-900">{row.salesName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', STATUS_CHIP[row.status])}>
                        {ts.targetStatus[row.status]}
                      </span>
                      <span className="num text-[16px] font-semibold text-slate-900">
                        {row.att !== null ? `${row.att}%` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {row.targetAmount !== null ? (
                    <>
                      <TargetBar
                        label={ts.targetValue}
                        pct={row.targetAmountPercent}
                        expected={expected}
                        status={row.status}
                        figure={<>{formatCurrency(row.achievedAmount, currency, locale)} / {formatCurrency(row.targetAmount, currency, locale)}</>}
                      />
                      <TargetBar
                        label={ts.targetUnits}
                        pct={row.targetUnitsPercent}
                        expected={expected}
                        status={row.status}
                        figure={<>{row.achievedUnits} / {row.targetUnits ?? 0}</>}
                      />
                    </>
                  ) : (
                    <p className="text-[12.5px] text-slate-500 sm:col-span-2">
                      {m.noTargetLabel} · {formatCurrency(row.achievedAmount, currency, locale)} · {row.achievedUnits} {m.unitsSuffix}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { l: m.legendLeads, v: row.leadsCount, dot: 'bg-sky-500' },
                    { l: m.legendVisits, v: row.visitsCount, dot: 'bg-violet-500' },
                    { l: m.legendReservations, v: row.reservationsCount, dot: 'bg-amber-500' },
                    { l: m.legendContracts, v: row.signedContractsCount, dot: 'bg-emerald-500' },
                  ].map((c) => (
                    <div key={c.l} className="rounded-xl bg-surface-muted/50 px-2 py-2 text-center">
                      <p className="num text-[18px] font-semibold leading-none text-slate-900">{c.v}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-slate-500">
                        <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                        {c.l}
                      </p>
                    </div>
                  ))}
                </div>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-3 bg-surface-muted/40 px-6 py-4 text-[13px]">
              <span className="font-bold text-slate-700">{m.totalsLabel}</span>
              <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-500">
                <span>{m.legendLeads} <b className="text-slate-900 tabular-nums">{totalLeads}</b></span>
                <span>{m.legendVisits} <b className="text-slate-900 tabular-nums">{totalVisits}</b></span>
                <span>{m.legendReservations} <b className="text-slate-900 tabular-nums">{totalRes}</b></span>
                <span>{m.legendContracts} <b className="text-slate-900 tabular-nums">{totalContracts}</b></span>
              </span>
            </li>
          </ul>
        </PremiumPanel>
      )}

      {/* ── Pipeline + bonus ──────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
          <PremiumPanel className="lg:col-span-2" title={m.pipelineTitle} sub={m.pipelineDesc}>
            <div className="space-y-4">
              {pipelineFlow.map((stage, i) => (
                <div key={stage.label}>
                  <div className="flex items-center gap-3">
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', stage.dot)} />
                    <span className="w-28 shrink-0 text-[13px] font-semibold text-slate-700">{stage.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className={cn('h-full rounded-full', stage.bar)} style={{ width: `${stage.pct}%` }} />
                    </div>
                    <span className="num w-8 shrink-0 text-end text-[20px] font-semibold leading-none text-slate-900">
                      {stage.value.toLocaleString(intlLocale(locale))}
                    </span>
                  </div>
                  {i > 0 && stage.conv !== null && (
                    <p className="ms-[22px] mt-1 text-[11px] text-slate-500 tabular-nums">↳ {(stage.conv * 100).toFixed(0)}%</p>
                  )}
                </div>
              ))}
              {pipelineOverallConv !== null && (
                <div className="flex items-center justify-between gap-2 border-t border-hairline pt-4">
                  <span className="text-[12.5px] text-slate-500">{m.pipelineOverallConvLabel}</span>
                  <span className="num text-[20px] font-semibold text-brand-700">{(pipelineOverallConv * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </PremiumPanel>

          <PremiumPanel
            className="lg:col-span-3"
            title={m.bonusTitle}
            sub={periodStr}
            link={{ href: '/dashboard/bonus', label: m.bonusViewAllBtn }}
            padding={bonus.length === 0 ? 'normal' : 'none'}
          >
            {bonus.length === 0 ? (
              <PremiumEmptyNote>
                <span className="block font-semibold text-slate-700">{m.bonusEmptyTitle}</span>
                {m.bonusEmptyDesc}
              </PremiumEmptyNote>
            ) : (
              <>
                <div className="divide-y divide-hairline border-t border-hairline">
                  {bonus.map((entry) => {
                    const S = {
                      PENDING:  { label: m.bonusStatusPending,  cls: 'bg-slate-500/10 text-slate-600' },
                      APPROVED: { label: m.bonusStatusApproved, cls: 'bg-amber-500/12 text-amber-600' },
                      PAID:     { label: m.bonusStatusPaid,     cls: 'bg-emerald-500/12 text-emerald-600' },
                    } as const;
                    const st = S[entry.status] ?? S.PENDING;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-surface-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-slate-900">{entry.sales?.fullName ?? '—'}</p>
                          <p className="mt-0.5 text-[11.5px] text-slate-500">
                            {entry.rule?.name ?? (entry.source === 'CONTRACT_AUTO' ? m.bonusAutoCommission : m.bonusManual)}
                            {entry.commissionPct ? ` · ${entry.commissionPct}%` : ''}
                            {entry.basisAmount ? ` ${m.bonusBasisPrefix}${formatCurrency(Number(entry.basisAmount), currency, locale)}` : ''}
                          </p>
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', st.cls)}>{st.label}</span>
                        <p dir="ltr" className="shrink-0 whitespace-nowrap text-[14px] font-bold tabular-nums text-slate-900">
                          {formatCurrency(Number(entry.amount), currency, locale)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between border-t border-hairline bg-surface-muted/40 px-6 py-3.5">
                  <span className="text-[12.5px] font-semibold text-slate-500">{m.totalsLabel}</span>
                  <p dir="ltr" className="num text-[20px] font-semibold text-slate-900">{formatCurrency(totalBonusAmt, currency, locale)}</p>
                </div>
              </>
            )}
          </PremiumPanel>
        </div>
      )}
    </div>
  );
}
