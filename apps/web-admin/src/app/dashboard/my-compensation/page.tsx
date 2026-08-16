import {
  Clock,
  CheckCircle2,
  Banknote,
  Hash,
  Target,
  Users,
  CalendarClock,
  BookmarkCheck,
  FileText,
  AlertCircle,
  Wallet,
  TrendingUp,
  Award,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

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

// ── Pure helpers ───────────────────────────────────────────────────────────

function fmtAmt(value: number | string | null | undefined, symbol = 'ج.م'): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('en-US')} ${symbol}`;
}

function pctLabel(value: number | null): string {
  if (value === null) return '—';
  return value > 999 ? '+999%' : `${value}%`;
}

function pctBarColor(pct: number): string {
  if (pct >= 100) return 'bg-success-500';
  if (pct >= 75)  return 'bg-brand-400';
  if (pct >= 50)  return 'bg-amber-400';
  return 'bg-red-400';
}

function pctTextColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct >= 100)   return 'text-success-700';
  if (pct >= 75)    return 'text-brand-700';
  if (pct >= 50)    return 'text-amber-700';
  return 'text-red-600';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 text-warning-700 text-sm p-4">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>{msg}</p>
    </div>
  );
}

function PctCell({ pct, neutral = false }: { pct: number | null; neutral?: boolean }) {
  if (pct === null) return <span className="text-slate-300 text-xs">—</span>;
  const display = pctLabel(pct);
  return (
    <div className="flex flex-col gap-1 min-w-[56px]">
      <span className={cn('text-xs tabular-nums font-medium', neutral ? 'text-slate-400' : pctTextColor(pct))}>
        {display}
      </span>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-14" dir="ltr">
        <div
          className={cn('h-full rounded-full', neutral ? 'bg-slate-200' : pctBarColor(pct))}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function PerfBadge({ pct, labels }: { pct: number | null; labels: { none: string; excellent: string; onTrack: string; needsEffort: string; needsAttention: string } }) {
  if (pct === null)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium bg-slate-100 text-slate-400">
        {labels.none}
      </span>
    );
  if (pct >= 100)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <Award className="h-2.5 w-2.5" /> {labels.excellent}
      </span>
    );
  if (pct >= 75)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        {labels.onTrack}
      </span>
    );
  if (pct >= 50)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
        {labels.needsEffort}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
      {labels.needsAttention}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function MyCompensationPage() {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const m = uiT(locale).myCompensationPage;

  const nowIso = new Date().toISOString();
  const selfId = session?.id;
  const selfParam = selfId ? `salesId=${selfId}` : '';

  const [bonusRes, targetsRes, leadsRes, reservationsRes, visitsRes, currency] =
    await Promise.all([
      safe(api.get<BonusEntry[] | Paged<BonusEntry>>(`/bonus-entries${selfParam ? `?${selfParam}` : ''}`)),
      safe(api.get<SalesTarget[]>(`/sales-targets${selfParam ? `?${selfParam}` : ''}`)),
      safe(api.get<Paged<Lead>>(`/leads?pageSize=100${selfParam ? `&${selfParam}` : ''}`)),
      safe(api.get<Paged<Reservation>>(`/reservations?pageSize=100${selfParam ? `&${selfParam}` : ''}`)),
      selfId
        ? safe(
            api.get<Paged<VisitAppointment>>(
              `/visits/appointments?assignedSalesId=${selfId}&scheduledFrom=${nowIso}&pageSize=50`,
            ),
          )
        : Promise.resolve({ data: undefined, error: m.noSession as string }),
      getReportsCurrency(),
    ]);
  const symbol = currencySymbol(currency);

  function periodLabel(period: string): string {
    const [y, mo] = period.split('-');
    const mIdx = parseInt(mo ?? '0', 10) - 1;
    const name = m.months[mIdx] ?? period;
    return `${name} ${y}`;
  }

  function getPlanDisplay(planName: string | null | undefined, source: EntrySource | undefined): string {
    if (source === 'MANUAL') return m.planManual;
    if (!planName) return m.planDefault;
    if (/\b(test|temp|debug|draft|sample|example)\b/i.test(planName)) return m.planDefault;
    return planName;
  }

  const entries = Array.isArray(bonusRes.data)
    ? bonusRes.data
    : (bonusRes.data?.data ?? []);
  const targets = targetsRes.data ?? [];
  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const upcomingVisits = visitsRes.data?.data ?? [];

  const currentPeriod = nowIso.slice(0, 7);
  const perfPeriods = [...new Set([currentPeriod, ...targets.map((t) => t.period)])];
  const perfResults = await Promise.all(
    perfPeriods.map((p) =>
      safe(
        api.get<PerformanceRow[]>(
          `/sales-targets/performance?period=${p}${selfParam ? `&${selfParam}` : ''}`,
        ),
      ),
    ),
  );
  const perfByPeriod = new Map<string, PerformanceRow>();
  perfResults.forEach((r, i) => {
    const row = (r.data ?? [])[0];
    if (row) perfByPeriod.set(perfPeriods[i]!, row);
  });
  const currentPerf = perfByPeriod.get(currentPeriod);

  const sumByStatus = (s: EntryStatus) =>
    entries.filter((e) => e.status === s).reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal  = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal     = sumByStatus('PAID');
  const owedTotal     = pendingTotal + approvedTotal;

  const lastPaidAt = entries
    .filter((e) => e.status === 'PAID' && e.paidAt)
    .map((e) => e.paidAt as string)
    .sort()
    .at(-1);

  const openLeads          = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
  const activeReservations = reservations.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length;
  const convertedDeals     = reservations.filter((r) => r.status === 'CONVERTED').length;

  const perfOpenLeads          = currentPerf?.openLeadsCount          ?? openLeads;
  const perfUpcomingVisits     = currentPerf?.upcomingVisitsCount      ?? upcomingVisits.length;
  const perfActiveReservations = currentPerf?.activeReservationsCount  ?? activeReservations;
  const perfClosed             = currentPerf?.signedContractsCount      ?? convertedDeals;
  const perfClosedLabel        = currentPerf ? m.perfClosedContractsLabel : m.perfClosedDealsLabel;

  const allPerfZero =
    perfOpenLeads === 0 &&
    perfUpcomingVisits === 0 &&
    perfActiveReservations === 0 &&
    perfClosed === 0;

  const perfBadgeLabels = {
    none: m.perfBadgeNone,
    excellent: m.perfBadgeExcellent,
    onTrack: m.perfBadgeOnTrack,
    needsEffort: m.perfBadgeNeedsEffort,
    needsAttention: m.perfBadgeNeedsAttention,
  };

  const activityMetrics = [
    ...(perfOpenLeads > 0
      ? [{ label: m.activityOpenLeads,        value: String(perfOpenLeads),         icon: <Users />,         tone: 'brand'   as const }]
      : []),
    ...(perfUpcomingVisits > 0
      ? [{ label: m.activityUpcomingVisits,   value: String(perfUpcomingVisits),    icon: <CalendarClock />, tone: 'neutral' as const }]
      : []),
    ...(perfActiveReservations > 0
      ? [{ label: m.activityActiveReservations, value: String(perfActiveReservations), icon: <BookmarkCheck />, tone: 'success' as const }]
      : []),
    ...(perfClosed > 0
      ? [{ label: m.activityClosedDeals, value: String(perfClosed), sub: perfClosedLabel, icon: <FileText />, tone: 'info' as const }]
      : []),
  ];

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={m.title}
        description={
          session?.role === 'SALES_MANAGER'
            ? m.descriptionManager
            : m.descriptionStaff
        }
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbSelf },
        ]}
      />

      {/* KPI strip */}
      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: m.kpiOwed,     value: fmtAmt(owedTotal, symbol),    icon: <Hash />,         tone: 'brand',   sub: owedTotal === 0 ? m.kpiOwedSubNone : m.kpiOwedSubHas    },
          { label: m.kpiPaid,     value: fmtAmt(paidTotal, symbol),    icon: <Banknote />,     tone: 'success', sub: lastPaidAt ? m.kpiPaidSubLast(formatDate(lastPaidAt)) : (paidTotal === 0 ? m.kpiPaidSubNone : undefined) },
          { label: m.kpiApproved, value: fmtAmt(approvedTotal, symbol), icon: <CheckCircle2 />, tone: 'info',    sub: approvedTotal === 0 ? m.kpiApprovedSubNone : m.kpiApprovedSubHas },
          { label: m.kpiPending,  value: fmtAmt(pendingTotal, symbol),  icon: <Clock />,        tone: 'warning', sub: pendingTotal === 0 ? m.kpiPendingSubNone : m.kpiPendingSubHas },
        ]}
      />

      {/* Compensation entries */}
      <PremiumSectionCard icon={<Wallet />} title={m.entriesSectionTitle} padded={false}
        trailing={
          !bonusRes.error && entries.length > 0
            ? <span className="text-2xs font-semibold text-slate-400">{m.entriesCountSuffix(entries.length)}</span>
            : undefined
        }
      >
        {bonusRes.error ? (
          <SectionError msg={m.errorSection} />
        ) : entries.length === 0 ? (
          <EmptyState icon={<Wallet />} title={m.entriesEmpty} className="py-12" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                <tr>
                  <th className="px-5 py-2.5 text-start font-medium whitespace-nowrap">{m.colPeriod}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{m.colReason}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colSource}</th>
                  <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">{m.colAmount}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colStatus}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colPaidAt}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colCreatedAt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700">{periodLabel(e.period)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">{getPlanDisplay(e.rule?.name, e.source)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', e.source === 'CONTRACT_AUTO' ? 'bg-info-100 text-info-700' : 'bg-slate-100 text-slate-600')}>
                        {m.sourceLabels[e.source ?? 'MANUAL']}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-slate-800 text-sm">{fmtAmt(e.amount, symbol)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                        e.status === 'PENDING'  ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' :
                        e.status === 'APPROVED' ? 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-100' :
                        'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100',
                      )}>
                        {m.statusLabels[e.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {e.paidAt ? formatDate(e.paidAt) : <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-400 tabular-nums">{formatDate(e.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* My targets */}
      <PremiumSectionCard icon={<Target />} title={m.targetsSectionTitle} padded={false}
        trailing={
          !targetsRes.error && targets.length > 0
            ? <span className="text-2xs font-semibold text-slate-400">{m.targetsCountSuffix(targets.length)}</span>
            : undefined
        }
      >
        {targetsRes.error ? (
          <SectionError msg={m.errorSection} />
        ) : targets.length === 0 ? (
          <EmptyState icon={<Target />} title={m.targetsEmpty} className="py-12" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[740px]">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                <tr>
                  <th className="px-5 py-2.5 text-start font-medium whitespace-nowrap">{m.colMonth}</th>
                  <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">{m.colValueTarget}</th>
                  <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">{m.colAchieved}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colValuePct}</th>
                  <th className="px-4 py-2.5 text-center font-medium whitespace-nowrap">{m.colUnits}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colUnitsPct}</th>
                  <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">{m.colPerformance}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {targets.map((t) => {
                  const perf = perfByPeriod.get(t.period);
                  const amtPct = perf?.targetAmountPercent ?? null;
                  const unitPct = perf?.targetUnitsPercent ?? null;
                  const noActivity = !perf || (perf.achievedAmount === 0 && perf.achievedUnits === 0);

                  return (
                    <tr key={t.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">{periodLabel(t.period)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-end">
                        <span className="tabular-nums font-semibold text-slate-800 text-sm">{fmtAmt(t.amountTarget, symbol)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-end">
                        {perf ? (
                          <span className={cn('tabular-nums text-sm', perf.achievedAmount > 0 ? 'font-semibold text-success-700' : 'text-slate-400')}>
                            {fmtAmt(perf.achievedAmount, symbol)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PctCell pct={perf ? (amtPct ?? 0) : null} neutral={noActivity} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1 tabular-nums text-xs">
                          <span className="text-slate-600">{t.unitsTarget}</span>
                          {perf && (
                            <>
                              <span className="text-slate-300">/</span>
                              <span className={cn(perf.achievedUnits > 0 ? 'font-semibold text-success-700' : 'text-slate-400')}>
                                {perf.achievedUnits}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PctCell pct={perf ? (unitPct ?? 0) : null} neutral={noActivity} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PerfBadge pct={noActivity ? null : (amtPct ?? 0)} labels={perfBadgeLabels} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-5 py-2.5 text-2xs text-slate-400 border-t border-hairline">
              {m.targetsNote}
            </p>
          </div>
        )}
      </PremiumSectionCard>

      {/* Current activity */}
      {!allPerfZero && (
        <PremiumSectionCard icon={<TrendingUp />} title={m.activityTitle} description={m.activityDesc}>
          <PremiumMetricStrip variant="compact" metrics={activityMetrics} />
        </PremiumSectionCard>
      )}
    </div>
  );
}
