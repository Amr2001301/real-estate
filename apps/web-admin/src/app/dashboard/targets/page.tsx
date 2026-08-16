import { Banknote, Building2, Target, TrendingUp, Award } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';
import {
  TargetsManagementClient,
  type PerformanceRow,
} from './targets-management-client';
import { fmtAmt, num, pctLabel, getMonthOptions, YEAR_OPTIONS } from './utils';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────

interface SalesUser {
  id: string;
  fullName: string;
  role?: string;
}

interface SalesTarget {
  id: string;
  salesId: string; // FK — always present on the Prisma record
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
  sales?: { id: string; fullName: string } | null;
}

// ── Filter year options ────────────────────────────────────────────────────

const FILTER_YEARS = (() => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1].map(String);
})();

// ── Page ──────────────────────────────────────────────────────────────────

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [session, locale, currency] = await Promise.all([
    getSession(),
    getLocale(),
    getReportsCurrency(),
  ]);
  const m = uiT(locale).targetsPage;
  const symbol = currencySymbol(currency);

  const isAdmin = session?.role === 'ADMIN';
  const isSalesManager = session?.role === 'SALES_MANAGER';
  const canManage = isAdmin || isSalesManager;

  const period: string | undefined =
    sp.year && sp.month ? `${sp.year}-${sp.month}` : sp.period ?? undefined;

  const listUrl = sp.salesId
    ? `/sales-targets?salesId=${encodeURIComponent(sp.salesId)}`
    : '/sales-targets';

  const [targetsRes, salesRes] = await Promise.all([
    safe(api.get<SalesTarget[]>(listUrl)),
    safe(api.get<SalesUser[]>('/sales-targets/actors')),
  ]);

  const allTargets = targetsRes.data ?? [];
  const targets = period
    ? allTargets.filter((t) => t.period === period)
    : allTargets;

  let salesUsers: SalesUser[] = salesRes.data ?? [];
  if (salesUsers.length === 0) {
    const seen = new Set<string>();
    for (const t of allTargets) {
      const uid = t.sales?.id ?? t.salesId;
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        salesUsers.push({ id: uid, fullName: t.sales?.fullName ?? uid });
      }
    }
  }

  const distinctPeriods = [...new Set(targets.map((t) => t.period))];
  const perfResults = await Promise.all(
    distinctPeriods.map((p) =>
      safe(
        api.get<PerformanceRow[]>(
          `/sales-targets/performance?period=${p}${
            sp.salesId ? `&salesId=${encodeURIComponent(sp.salesId)}` : ''
          }`,
        ),
      ),
    ),
  );
  const perfRows: PerformanceRow[] = perfResults.flatMap((r) => r.data ?? []);

  const perfMap = new Map<string, PerformanceRow>(
    perfRows.map((r) => [`${r.salesId}|${r.period}`, r]),
  );

  // ── KPI rollups ──────────────────────────────────────────────────────────
  const totalAmountTarget = targets.reduce((s, t) => s + Number(t.amountTarget), 0);
  const totalUnitsTarget = targets.reduce((s, t) => s + t.unitsTarget, 0);
  const totalAchievedAmount = targets.reduce((s, t) => {
    const perf = t.sales?.id ? perfMap.get(`${t.sales.id}|${t.period}`) : undefined;
    return s + (perf?.achievedAmount ?? 0);
  }, 0);
  const totalAchievedUnits = targets.reduce((s, t) => {
    const perf = t.sales?.id ? perfMap.get(`${t.sales.id}|${t.period}`) : undefined;
    return s + (perf?.achievedUnits ?? 0);
  }, 0);
  const overallPct =
    totalAmountTarget > 0
      ? Math.round((totalAchievedAmount / totalAmountTarget) * 100)
      : null;

  // ── Performance insights ──────────────────────────────────────────────────
  const perfBySalesId = new Map<string, { name: string; totalPct: number; count: number }>();
  for (const t of targets) {
    if (!t.sales?.id) continue;
    const perf = perfMap.get(`${t.sales.id}|${t.period}`);
    if (perf?.targetAmountPercent == null) continue;
    const existing = perfBySalesId.get(t.sales.id);
    if (existing) {
      existing.totalPct += perf.targetAmountPercent;
      existing.count += 1;
    } else {
      perfBySalesId.set(t.sales.id, {
        name: t.sales.fullName,
        totalPct: perf.targetAmountPercent,
        count: 1,
      });
    }
  }
  const sortedInsights = [...perfBySalesId.values()]
    .map((p) => ({ name: p.name, pct: Math.round(p.totalPct / p.count) }))
    .sort((a, b) => b.pct - a.pct);
  const topPerformer = sortedInsights[0] ?? null;
  const lowPerformer =
    sortedInsights.length > 1 ? sortedInsights[sortedInsights.length - 1] : null;
  const avgPct =
    sortedInsights.length > 0
      ? Math.round(
          sortedInsights.reduce((s, p) => s + p.pct, 0) / sortedInsights.length,
        )
      : null;
  const hasMeaningfulPerf = topPerformer !== null && topPerformer.pct > 0;
  const hasFilters = !!(sp.salesId || sp.year || sp.month || sp.period);

  const monthOptions = getMonthOptions(locale);

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={canManage ? m.descriptionAdmin : m.descriptionView}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbTargets },
        ]}
      />

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/targets"
        trailing={
          <div className="flex items-center gap-2 ms-auto shrink-0">
            {hasFilters && (
              <a href="/dashboard/targets">
                <Button type="button" variant="ghost" size="sm">{m.btnClear}</Button>
              </a>
            )}
            <Button type="submit" variant="primary" size="sm">{m.btnApply}</Button>
          </div>
        }
      >
        <PremiumFilterField label={m.filterAgent} htmlFor="f-salesId">
          <Select
            id="f-salesId"
            name="salesId"
            inputSize="sm"
            defaultValue={sp.salesId ?? ''}
            className="w-44"
          >
            <option value="">{m.filterAgentAll}</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role === 'SALES_MANAGER'
                  ? `${u.fullName} — ${m.roleManager}`
                  : `${u.fullName} — ${m.roleSales}`}
              </option>
            ))}
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={m.filterMonth} htmlFor="f-month">
          <Select
            id="f-month"
            name="month"
            inputSize="sm"
            defaultValue={sp.month ?? (period?.split('-')[1] ?? '')}
            className="w-28"
          >
            <option value="">{m.filterMonthPlaceholder}</option>
            {monthOptions.map((mo) => (
              <option key={mo.value} value={mo.value}>{mo.label}</option>
            ))}
          </Select>
        </PremiumFilterField>

        <PremiumFilterField label={m.filterYear} htmlFor="f-year">
          <Select
            id="f-year"
            name="year"
            inputSize="sm"
            defaultValue={sp.year ?? (period?.split('-')[0] ?? '')}
            className="w-24"
          >
            <option value="">{m.filterYearPlaceholder}</option>
            {FILTER_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        metrics={[
          {
            label: m.metricTargetsCount,
            value: String(targets.length),
            icon: <Target />,
            tone: 'neutral',
          },
          {
            label: m.metricAmountTarget,
            value: totalAmountTarget === 0 ? '—' : fmtAmt(totalAmountTarget, symbol),
            icon: <Banknote />,
            tone: 'brand',
            valueSize: 'compact',
          },
          {
            label: m.metricAchievedAmount,
            value: fmtAmt(totalAchievedAmount, symbol),
            sub: overallPct !== null ? `${overallPct}% ${m.metricOfTarget}` : undefined,
            icon: <TrendingUp />,
            tone: totalAchievedAmount > 0 ? 'success' : 'neutral',
            valueSize: 'compact',
          },
          {
            label: m.metricUnitsTarget,
            value: num(totalUnitsTarget),
            sub: totalAchievedUnits > 0 ? `${num(totalAchievedUnits)} ${m.metricAchievedUnits}` : undefined,
            icon: <Building2 />,
            tone: 'info',
          },
        ]}
      />

      {/* ── Performance insights strip ────────────────────────────────────── */}
      {hasMeaningfulPerf ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-surface border border-hairline rounded-[20px] shadow-soft px-5 py-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-brand-500 shrink-0" />
            <span className="text-2xs text-slate-400">{m.insightTop}</span>
            <span className="text-sm font-semibold text-slate-800">{topPerformer!.name}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-2xs font-bold tabular-nums">
              {pctLabel(topPerformer!.pct)}
            </span>
          </div>
          {avgPct !== null && (
            <>
              <div className="hidden sm:block w-px h-4 bg-hairline" />
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-2xs text-slate-400">{m.insightAvg}</span>
                <span className="text-sm font-medium text-slate-700 tabular-nums">
                  {pctLabel(avgPct)}
                </span>
              </div>
            </>
          )}
          {lowPerformer && lowPerformer.name !== topPerformer!.name && (
            <>
              <div className="hidden sm:block w-px h-4 bg-hairline" />
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-400">{m.insightSupport}</span>
                <span className="text-sm font-medium text-slate-700">{lowPerformer.name}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-2xs font-bold tabular-nums">
                  {pctLabel(lowPerformer.pct)}
                </span>
              </div>
            </>
          )}
          {totalAchievedUnits > 0 && (
            <>
              <div className="hidden sm:block w-px h-4 bg-hairline" />
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-2xs text-slate-400">{m.insightUnits}</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {num(totalAchievedUnits)}
                </span>
              </div>
            </>
          )}
        </div>
      ) : targets.length > 0 ? (
        <div className="flex items-center gap-3 bg-surface border border-hairline rounded-[20px] shadow-soft px-5 py-3">
          <TrendingUp className="h-4 w-4 text-slate-300 shrink-0" />
          <p className="text-xs text-slate-500">
            {m.noAchievedYet}{' '}
            <span className="text-slate-400">{m.noAchievedSub}</span>
          </p>
        </div>
      ) : null}

      {/* ── Interactive table + dialog (client component) ─────────────────── */}
      <TargetsManagementClient
        canManage={canManage}
        salesUsers={salesUsers}
        targets={targets}
        perfRows={perfRows}
        hasFilters={hasFilters}
        error={targetsRes.error ?? undefined}
        symbol={symbol}
        locale={locale}
      />
    </div>
  );
}
