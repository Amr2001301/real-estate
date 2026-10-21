import { Target, TrendingUp, Award } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';
import {
  TargetsManagementClient,
  type PerformanceRow,
} from './targets-management-client';
import { pctLabel, getMonthOptions } from './utils';
import { compactParts } from '@/lib/format';
import { Amount, FigureBar, PaceBar } from '@/components/cockpit/cockpit';
import { cn } from '@/lib/cn';
import { attainment, targetPhase } from '@/lib/target-pace';
import { getReportsCurrency, currencySymbol, getCompanyTimeZone, todayIn } from '@/lib/currency';

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
  const [session, locale, currency, tz] = await Promise.all([
    getSession(),
    getLocale(),
    getReportsCurrency(),
    getCompanyTimeZone(),
  ]);
  const today = todayIn(tz);
  const m = uiT(locale).targetsPage;
  const symbol = currencySymbol(currency, locale);

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
    const att = perf ? attainment(perf.targetAmountPercent, perf.targetUnitsPercent) : null;
    if (att === null || targetPhase(t.period, today) === 'upcoming') continue;
    const existing = perfBySalesId.get(t.sales.id);
    if (existing) {
      existing.totalPct += att;
      existing.count += 1;
    } else {
      perfBySalesId.set(t.sales.id, { name: t.sales.fullName, totalPct: att, count: 1 });
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
    <div className="space-y-6">
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

      {/* ── Key figures ───────────────────────────────────────────────────── */}
      <section data-testid="targets-kpis" className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: m.metricTargetsCount, value: targets.length },
            { label: m.metricAmountTarget, value: totalAmountTarget === 0 ? '—' : <Amount parts={compactParts(totalAmountTarget, symbol, locale)} /> },
            {
              label: m.metricAchievedAmount,
              value: <Amount parts={compactParts(totalAchievedAmount, symbol, locale)} />,
              sub: overallPct !== null ? `${overallPct}% ${m.metricOfTarget}` : undefined,
            },
            { label: m.metricUnitsTarget, value: totalUnitsTarget, sub: `${totalAchievedUnits} ${m.metricAchievedUnits}` },
          ]}
        />
        {overallPct !== null && (
          <div className="border-t border-hairline px-5 py-4">
            <PaceBar pct={overallPct} tone="bg-gradient-to-l from-[#E6C77E] to-[#B8913F]" />
          </div>
        )}
      </section>

      {/* ── Insights ──────────────────────────────────────────────────────── */}
      {hasMeaningfulPerf ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Insight icon={<Award />} label={m.insightTop} name={topPerformer!.name} pct={topPerformer!.pct} tone="good" />
          {avgPct !== null && <Insight icon={<TrendingUp />} label={m.insightAvg} name={uiT(locale).common.targetAttainmentHint} pct={avgPct} />}
          {lowPerformer && lowPerformer.name !== topPerformer!.name && (
            <Insight icon={<Target />} label={m.insightSupport} name={lowPerformer.name} pct={lowPerformer.pct} tone="warn" />
          )}
        </div>
      ) : targets.length > 0 ? (
        <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-hairline px-5 py-4">
          <TrendingUp className="h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-[13px] text-slate-500">
            {m.noAchievedYet} <span className="text-slate-400">{m.noAchievedSub}</span>
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
        today={today}
        locale={locale}
      />
    </div>
  );
}

function Insight({
  icon,
  label,
  name,
  pct,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  pct: number;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-hairline bg-surface p-5">
      <span
        className={cn(
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5',
          tone === 'good' ? 'bg-emerald-500/12 text-emerald-600' : tone === 'warn' ? 'bg-amber-500/12 text-amber-600' : 'bg-brand-500/12 text-brand-700',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-500">{label}</p>
        <p className="truncate text-[14px] font-bold text-slate-900">{name}</p>
      </div>
      <span className="text-[26px] font-bold tabular-nums text-slate-900">{pctLabel(pct)}</span>
    </div>
  );
}
