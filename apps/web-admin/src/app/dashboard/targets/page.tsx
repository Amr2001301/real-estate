import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Target, Plus, AlertCircle, Award, TrendingUp, Banknote, Building2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { PageKpiCard } from '@/components/ui/page-kpi-card';

export const dynamic = 'force-dynamic';

interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

function salesActorLabel(u: SalesUser): string {
  return u.role === 'SALES_MANAGER' ? `${u.fullName} — مدير مبيعات` : `${u.fullName} — مبيعات`;
}

interface SalesTarget {
  id: string;
  period: string;
  amountTarget: string | number;
  unitsTarget: number;
  sales?: { id: string; fullName: string };
}

interface PerformanceRow {
  salesId: string;
  period: string;
  achievedAmount: number;
  achievedUnits: number;
  targetAmountPercent: number | null;
  targetUnitsPercent: number | null;
}

function pctLabel(value: number | null): string {
  if (value === null) return '—';
  // Arabic-Indic zero "٠" renders as a tiny dot at small text sizes — use Latin '0'.
  const str = value === 0 ? '0' : value.toLocaleString('ar-EG');
  return `${str}%`;
}

function redirectBack(formData: FormData, err?: string): never {
  const base = String(formData.get('returnTo') || '/dashboard/targets');
  if (!err) redirect(base);
  const sep = base.includes('?') ? '&' : '?';
  redirect(`${base}${sep}err=${encodeURIComponent(err)}`);
}

// POST /sales-targets is an upsert keyed on (salesId, period): creating a target
// for an existing rep+month updates it rather than duplicating.
async function upsertTargetAction(formData: FormData) {
  'use server';
  const res = await safe(
    api.post('/sales-targets', {
      salesId: String(formData.get('salesId') ?? ''),
      period: String(formData.get('period') ?? ''),
      amountTarget: Number(formData.get('amountTarget') ?? 0),
      unitsTarget: Number(formData.get('unitsTarget') ?? 0),
    }),
  );
  if (res.error) redirectBack(formData, res.error);
  revalidatePath('/dashboard/targets');
}

// Arabic-Indic zero "٠" renders as a small dot in most web fonts at display size;
// use Latin '0' for that case so the value is always clearly readable.
const num = (n: number) => n === 0 ? '0' : n.toLocaleString('ar-EG');

function pctBarColor(pct: number): string {
  if (pct >= 100) return 'bg-success-500/35';
  if (pct >= 50) return 'bg-brand-500/25';
  return 'bg-warning-500/30';
}

function pctTextColor(pct: number | null): string {
  if (pct === null) return 'text-slate-300';
  if (pct >= 100) return 'text-success-600 font-semibold';
  if (pct >= 75) return 'text-brand-600';
  if (pct >= 50) return 'text-slate-600';
  return 'text-warning-600';
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  // Creating/updating targets is an ADMIN action (targets:manage). SALES_MANAGER
  // sees this page as a read-only team targets + achievement view.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const listUrl = sp.salesId
    ? `/sales-targets?salesId=${encodeURIComponent(sp.salesId)}`
    : '/sales-targets';

  const [targetsRes, salesRes] = await Promise.all([
    safe(api.get<SalesTarget[]>(listUrl)),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  // The /sales-targets endpoint scopes by salesId only; the month filter is
  // applied in-memory (the target list per rep is small) to avoid a backend
  // change in this polish batch.
  const allTargets = targetsRes.data ?? [];
  const targets = sp.period
    ? allTargets.filter((t) => t.period === sp.period)
    : allTargets;
  const salesUsers = salesRes.data?.data ?? [];

  // Fetch realized performance once per distinct period present in the list and
  // index it by salesId|period. Failures degrade gracefully — the achieved
  // columns fall back to "—". ADMIN may pass salesId; the endpoint self-scopes.
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
  const perfMap = new Map<string, PerformanceRow>();
  for (const r of perfResults) {
    for (const row of r.data ?? []) perfMap.set(`${row.salesId}|${row.period}`, row);
  }

  // ── KPI derivations — no new API calls, all from fetched targets + perfMap ─
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

  // ── Performance insights — deduplicated by salesId, averaged across periods ─
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
  const lowPerformer = sortedInsights.length > 1
    ? (sortedInsights[sortedInsights.length - 1] ?? null)
    : null;

  const hasFilters = !!(sp.salesId || sp.period);
  const returnTo = (() => {
    const p = new URLSearchParams();
    if (sp.salesId) p.set('salesId', sp.salesId);
    if (sp.period) p.set('period', sp.period);
    const qs = p.toString();
    return `/dashboard/targets${qs ? `?${qs}` : ''}`;
  })();

  return (
    <div className="space-y-5">
      <PageHeader
        title="أهداف وأداء المبيعات"
        description="أهداف المبيعات الشهرية لكل مندوب مقابل القيمة والوحدات المحقّقة. الإضافة والتحديث متاحان للمشرف فقط."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'أهداف وأداء المبيعات' },
        ]}
      />

      {sp.err && (
        <div className="rounded-2xl bg-warning-50 text-warning-700 p-4 text-sm flex items-start gap-3 border border-warning-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">تعذّر حفظ الهدف</p>
            <p className="text-xs mt-0.5 text-warning-700/80">{sp.err}</p>
          </div>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <FilterBar
        method="get"
        action="/dashboard/targets"
        trailing={
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {hasFilters && (
              <a href="/dashboard/targets">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </a>
            )}
          </div>
        }
      >
        <FilterField label="المندوب" htmlFor="targets-salesId">
          <Select
            id="targets-salesId"
            name="salesId"
            inputSize="sm"
            defaultValue={sp.salesId ?? ''}
            className="w-44"
          >
            <option value="">كل المندوبين</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="الشهر" htmlFor="targets-period">
          <Input
            id="targets-period"
            name="period"
            type="month"
            inputSize="sm"
            defaultValue={sp.period ?? ''}
            className="w-40"
          />
        </FilterField>
      </FilterBar>

      {/* ── KPI summary cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard
          label="عدد الأهداف"
          value={num(targets.length)}
          icon={<Target className="h-5 w-5" />}
          tone="neutral"
        />
        <PageKpiCard
          label="إجمالي أهداف القيمة"
          value={totalAmountTarget === 0 ? '0 ر.س.' : formatCurrency(totalAmountTarget)}
          icon={<Banknote className="h-5 w-5" />}
          tone="brand"
          compact
        />
        <PageKpiCard
          label="إجمالي المحقق"
          value={totalAchievedAmount === 0 ? '0 ر.س.' : formatCurrency(totalAchievedAmount)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          compact
        />
        <PageKpiCard
          label="إجمالي أهداف الوحدات"
          value={num(totalUnitsTarget)}
          sub={totalAchievedUnits > 0 ? `${num(totalAchievedUnits)} وحدة محققة` : undefined}
          icon={<Building2 className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* ── Add / update target form (ADMIN only) ──────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                <Plus className="h-3 w-3 text-brand-600" />
              </div>
              <CardTitle className="text-sm">إضافة / تحديث هدف</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="px-5 py-3.5">
            {salesUsers.length === 0 ? (
              <p className="text-xs text-slate-400">يلزم وجود مندوب مبيعات واحد على الأقل.</p>
            ) : (
              <form action={upsertTargetAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="returnTo" value={returnTo} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="t-salesId" className="text-[11px] font-medium text-slate-400">المندوب</label>
                  <Select id="t-salesId" name="salesId" inputSize="sm" required className="w-44">
                    {salesUsers.map((u) => (
                      <option key={u.id} value={u.id}>{salesActorLabel(u)}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="t-period" className="text-[11px] font-medium text-slate-400">الشهر</label>
                  <Input id="t-period" name="period" type="month" required inputSize="sm" className="w-40" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="t-amount" className="text-[11px] font-medium text-slate-400">هدف القيمة</label>
                  <Input
                    id="t-amount"
                    name="amountTarget"
                    type="number"
                    step="any"
                    min={0}
                    required
                    inputSize="sm"
                    className="w-36"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="t-units" className="text-[11px] font-medium text-slate-400">هدف الوحدات</label>
                  <Input
                    id="t-units"
                    name="unitsTarget"
                    type="number"
                    min={0}
                    required
                    inputSize="sm"
                    className="w-28"
                    placeholder="0"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  حفظ الهدف
                </Button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              حفظ هدف لنفس المندوب والشهر يُحدّث الهدف الحالي بدلاً من تكراره.
            </p>
          </CardBody>
        </Card>
      )}

      {/* ── Performance insights strip ─────────────────────────────────────── */}
      {topPerformer && lowPerformer && (
        topPerformer.pct > 0 ? (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-500 shrink-0" />
              <span className="text-[11px] text-slate-400">أعلى أداء</span>
              <span className="text-sm font-semibold text-slate-800">{topPerformer.name}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-success-50 text-success-700 text-[10px] font-bold tabular-nums">
                {num(topPerformer.pct)}%
              </span>
            </div>
            <div className="w-px h-4 bg-hairline hidden sm:block" />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning-500 shrink-0" />
              <span className="text-[11px] text-slate-400">يحتاج دعمًا</span>
              <span className="text-sm font-medium text-slate-700">{lowPerformer.name}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-warning-50 text-warning-700 text-[10px] font-bold tabular-nums">
                {num(lowPerformer.pct)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-5 py-3 shadow-xs">
            <TrendingUp className="h-4 w-4 text-slate-300 shrink-0" />
            <p className="text-[11px] text-slate-400">لا توجد بيانات أداء محققة بعد لهذا الفلتر.</p>
          </div>
        )
      )}

      {/* ── Registered targets table ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">الأهداف المسجّلة</CardTitle>
          <span className="text-xs text-slate-400 tabular-nums">
            {targets.length === 0 ? '0' : targets.length.toLocaleString('ar-EG')} هدف
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {targetsRes.error ? (
            <div className="m-4 rounded-lg bg-red-50 text-red-700 p-3 text-sm">{targetsRes.error}</div>
          ) : targets.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title={hasFilters ? 'لا توجد أهداف مطابقة' : 'لا توجد أهداف مسجّلة'}
              description={
                hasFilters
                  ? 'لا توجد أهداف تطابق الفلاتر المختارة'
                  : 'أضف هدفاً لمندوب المبيعات للبدء'
              }
              action={
                hasFilters ? (
                  <a href="/dashboard/targets">
                    <Button variant="outline" size="sm">مسح الفلاتر</Button>
                  </a>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              {/* Achieved value/units come from GET /sales-targets/performance
                  (signed contracts in the period). Cells fall back to "—" when
                  performance data is unavailable for a row. */}
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-surface-muted/50 text-xs font-semibold text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المندوب</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">الشهر</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">هدف القيمة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المحقق (قيمة)</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">نسبة القيمة</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">هدف الوحدات</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">المحقق (وحدات)</th>
                    <th className="px-5 py-3 text-start whitespace-nowrap">نسبة الوحدات</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const perf = t.sales?.id
                      ? perfMap.get(`${t.sales.id}|${t.period}`)
                      : undefined;
                    const amtPct = perf?.targetAmountPercent ?? null;
                    const unitPct = perf?.targetUnitsPercent ?? null;
                    return (
                      <tr
                        key={t.id}
                        className="group border-t border-hairline hover:bg-brand-50/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {t.sales?.fullName ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-500 tabular-nums whitespace-nowrap font-mono text-xs">
                          {t.period}
                        </td>
                        <td className="px-5 py-3 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                          {formatCurrency(t.amountTarget)}
                        </td>
                        <td className="px-5 py-3 tabular-nums whitespace-nowrap text-slate-700">
                          {perf
                            ? formatCurrency(perf.achievedAmount)
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div>
                            <span className={cn('text-xs tabular-nums', pctTextColor(amtPct))}>
                              {pctLabel(amtPct)}
                            </span>
                            {amtPct !== null && (
                              <div
                                className="mt-0.5 h-0.5 bg-surface-muted rounded-full overflow-hidden w-16"
                                dir="ltr"
                              >
                                <div
                                  className={cn('h-full rounded-full', pctBarColor(amtPct))}
                                  style={{ width: `${Math.min(Math.max(amtPct, 0), 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                          {num(t.unitsTarget)}
                        </td>
                        <td className="px-5 py-3 tabular-nums whitespace-nowrap text-slate-700">
                          {perf
                            ? num(perf.achievedUnits)
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div>
                            <span className={cn('text-xs tabular-nums', pctTextColor(unitPct))}>
                              {pctLabel(unitPct)}
                            </span>
                            {unitPct !== null && (
                              <div
                                className="mt-0.5 h-0.5 bg-surface-muted rounded-full overflow-hidden w-16"
                                dir="ltr"
                              >
                                <div
                                  className={cn('h-full rounded-full', pctBarColor(unitPct))}
                                  style={{ width: `${Math.min(Math.max(unitPct, 0), 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-hairline">
                القيم المحققة محسوبة من العقود الموقّعة خلال الشهر لكل مندوب.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
