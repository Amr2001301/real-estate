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
  Eye,
  TrendingUp,
  Award,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

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

// ── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const SOURCE_LABEL: Record<EntrySource, string> = {
  MANUAL: 'إدخال يدوي',
  CONTRACT_AUTO: 'تلقائي من عقد',
};
const SOURCE_CLS: Record<EntrySource, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  CONTRACT_AUTO: 'bg-info-100 text-info-700',
};

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  PAID: 'مدفوع',
};
const STATUS_CLS: Record<EntryStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  APPROVED: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-100',
  PAID: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100',
};

// ── Pure helpers ───────────────────────────────────────────────────────────

// Latin-digit currency to avoid Arabic-Indic digit rendering in tables/KPIs.
function fmtAmt(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US') + ' ر.س';
}

// Returns a clean display label for the commission plan column.
// Masks internal/test plan names; surfaces source type for manual entries.
function getPlanDisplay(planName: string | null | undefined, source: EntrySource | undefined): string {
  if (source === 'MANUAL') return 'مستحق يدوي';
  if (!planName) return 'خطة عمولة';
  if (/\b(test|temp|debug|draft|sample|example)\b/i.test(planName)) return 'خطة عمولة';
  return planName;
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  const mIdx = parseInt(m ?? '0', 10) - 1;
  const name = MONTH_NAMES[mIdx] ?? period;
  return `${name} ${y}`;
}

function pctLabel(value: number | null): string {
  if (value === null) return '—';
  return value > 999 ? '+999%' : `${value}%`;
}

function pctBarColor(pct: number): string {
  if (pct >= 100) return 'bg-success-500';
  if (pct >= 75) return 'bg-brand-400';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function pctTextColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct >= 100) return 'text-success-700';
  if (pct >= 75) return 'text-brand-700';
  if (pct >= 50) return 'text-amber-700';
  return 'text-red-600';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionError() {
  return (
    <div className="flex items-start gap-2 text-warning-700 text-sm p-4">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>تعذّر تحميل هذا القسم.</p>
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

function PerfBadge({ pct }: { pct: number | null }) {
  if (pct === null)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium bg-slate-100 text-slate-400">
        لا يوجد أداء بعد
      </span>
    );
  if (pct >= 100)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
        <Award className="h-2.5 w-2.5" /> متقدم
      </span>
    );
  if (pct >= 75)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        على المسار
      </span>
    );
  if (pct >= 50)
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
        يحتاج جهدًا
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
      يحتاج متابعة
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function MyCompensationPage() {
  const session = await getSession();
  const nowIso = new Date().toISOString();

  // Strictly personal self-view. Pass salesId=<own id> to scope a SALES_MANAGER
  // to their own data (not team aggregates).
  const selfId = session?.id;
  const selfParam = selfId ? `salesId=${selfId}` : '';

  const [bonusRes, targetsRes, leadsRes, reservationsRes, visitsRes] =
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
        : Promise.resolve({ data: undefined, error: 'لا توجد جلسة' as string }),
    ]);

  const entries = Array.isArray(bonusRes.data)
    ? bonusRes.data
    : (bonusRes.data?.data ?? []);
  const targets = targetsRes.data ?? [];
  const leads = leadsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const upcomingVisits = visitsRes.data?.data ?? [];

  // Performance data: current month + each target period.
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

  // ── Financial KPI rollups ──────────────────────────────────────────────

  const sumByStatus = (s: EntryStatus) =>
    entries.filter((e) => e.status === s).reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  // Total outstanding (pending + approved, not yet disbursed)
  const owedTotal = pendingTotal + approvedTotal;

  const lastPaidAt = entries
    .filter((e) => e.status === 'PAID' && e.paidAt)
    .map((e) => e.paidAt as string)
    .sort()
    .at(-1);

  // ── Activity proxy (fallback when performance endpoint unavailable) ─────

  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  ).length;
  const convertedDeals = reservations.filter((r) => r.status === 'CONVERTED').length;

  const perfOpenLeads = currentPerf?.openLeadsCount ?? openLeads;
  const perfUpcomingVisits = currentPerf?.upcomingVisitsCount ?? upcomingVisits.length;
  const perfActiveReservations = currentPerf?.activeReservationsCount ?? activeReservations;
  const perfClosed = currentPerf?.signedContractsCount ?? convertedDeals;
  const perfClosedLabel = currentPerf ? 'عقود موقّعة هذا الشهر' : 'حجوزات محوّلة (تقديري)';

  const allPerfZero =
    perfOpenLeads === 0 &&
    perfUpcomingVisits === 0 &&
    perfActiveReservations === 0 &&
    perfClosed === 0;

  // Only non-zero metrics are shown individually inside the activity card.
  const activityCount = [perfOpenLeads, perfUpcomingVisits, perfActiveReservations, perfClosed].filter(v => v > 0).length;
  const activityGridCls =
    activityCount >= 4 ? 'grid-cols-2 lg:grid-cols-4' :
    activityCount === 3 ? 'grid-cols-3' :
    activityCount === 2 ? 'grid-cols-2' :
    'grid-cols-1 max-w-[220px]';

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="مستحقاتي وأهدافي"
        description={
          session?.role === 'SALES_MANAGER'
            ? 'بياناتك الشخصية كمندوب — منفصلة عن تقارير الفريق. جميع الأرقام للعرض فقط.'
            : 'ملخّصك الشخصي لمستحقات العمولات والمكافآت، والأهداف الشهرية، ونشاطك الحالي. للعرض فقط.'
        }
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مستحقاتي وأهدافي' },
        ]}
      />

      {/* ── Read-only notice ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <Eye className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-400">هذه الصفحة للعرض فقط — لا يمكنك تعديل أي بيانات من هنا.</span>
      </div>

      {/* ── A. Financial KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PageKpiCard
          label="إجمالي المستحق"
          value={fmtAmt(owedTotal)}
          sub={owedTotal === 0 ? 'لا توجد مستحقات مستحقة' : 'لم يُصرف بعد'}
          icon={<Hash />}
          tone="brand"
          compact
        />
        <PageKpiCard
          label="المدفوع"
          value={fmtAmt(paidTotal)}
          sub={lastPaidAt ? `آخر دفعة: ${formatDate(lastPaidAt)}` : (paidTotal === 0 ? 'لا يوجد صرف بعد' : undefined)}
          icon={<Banknote />}
          tone="success"
          compact
        />
        <PageKpiCard
          label="المعتمد"
          value={fmtAmt(approvedTotal)}
          sub={approvedTotal === 0 ? 'لا توجد مستحقات معتمدة' : 'معتمد وقيد الصرف'}
          icon={<CheckCircle2 />}
          tone="info"
          compact
        />
        <PageKpiCard
          label="المعلق"
          value={fmtAmt(pendingTotal)}
          sub={pendingTotal === 0 ? 'لا توجد مستحقات معلقة' : 'في انتظار الاعتماد'}
          icon={<Clock />}
          tone="warning"
          compact
        />
      </div>

      {/* ── B. Compensation entries ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">مستحقاتي</CardTitle>
            {!bonusRes.error && entries.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-surface-muted text-slate-500 text-2xs font-bold px-1.5 tabular-nums ms-1">
                {entries.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {bonusRes.error ? (
            <SectionError />
          ) : entries.length === 0 ? (
            <EmptyState icon={<Wallet />} title="لا توجد مستحقات حتى الآن" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-medium whitespace-nowrap">الفترة</th>
                    <th className="px-4 py-2.5 text-start font-medium">سبب المستحق</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">طريقة الإدخال</th>
                    <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">تاريخ الصرف</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-700">{periodLabel(e.period)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-700">
                          {getPlanDisplay(e.rule?.name, e.source)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', SOURCE_CLS[e.source ?? 'MANUAL'])}>
                          {SOURCE_LABEL[e.source ?? 'MANUAL']}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <span className="font-semibold tabular-nums text-slate-800 text-sm">{fmtAmt(e.amount)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', STATUS_CLS[e.status])}>
                          {STATUS_LABEL[e.status]}
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
        </CardBody>
      </Card>

      {/* ── C. My targets ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">أهدافي الشهرية</CardTitle>
            {!targetsRes.error && targets.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-surface-muted text-slate-500 text-2xs font-bold px-1.5 tabular-nums ms-1">
                {targets.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {targetsRes.error ? (
            <SectionError />
          ) : targets.length === 0 ? (
            <EmptyState icon={<Target />} title="لا توجد أهداف محدّدة بعد" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[740px]">
                <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-medium whitespace-nowrap">الشهر</th>
                    <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">هدف القيمة</th>
                    <th className="px-4 py-2.5 text-end font-medium whitespace-nowrap">المحقق</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">نسبة القيمة</th>
                    <th className="px-4 py-2.5 text-center font-medium whitespace-nowrap">الوحدات</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">نسبة الوحدات</th>
                    <th className="px-4 py-2.5 text-start font-medium whitespace-nowrap">الأداء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => {
                    const perf = perfByPeriod.get(t.period);
                    const amtPct = perf?.targetAmountPercent ?? null;
                    const unitPct = perf?.targetUnitsPercent ?? null;
                    // No activity = perf data loaded but nothing achieved yet
                    const noActivity = !perf || (perf.achievedAmount === 0 && perf.achievedUnits === 0);

                    return (
                      <tr key={t.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-700">{periodLabel(t.period)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-end">
                          <span className="tabular-nums font-semibold text-slate-800 text-sm">
                            {fmtAmt(t.amountTarget)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-end">
                          {perf ? (
                            <span className={cn(
                              'tabular-nums text-sm',
                              perf.achievedAmount > 0 ? 'font-semibold text-success-700' : 'text-slate-400',
                            )}>
                              {fmtAmt(perf.achievedAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {/* neutral styling when nothing achieved yet; red only for actual underperformance */}
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
                          {/* PerfBadge gets null = "لا يوجد أداء بعد" when nothing achieved yet */}
                          <PerfBadge pct={noActivity ? null : (amtPct ?? 0)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-2.5 text-2xs text-slate-400 border-t border-hairline">
                القيم المحققة مستخرجة من العقود الموقّعة خلال كل شهر.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── D. Current activity — only non-zero metrics, hidden if all zero ─── */}
      {!allPerfZero && (
        <Card>
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">نشاطي الحالي</CardTitle>
              <span className="text-2xs text-slate-400 ms-1">هذا الشهر</span>
            </div>
          </CardHeader>
          <CardBody className="pb-4 pt-0">
            <div className={cn('grid gap-3', activityGridCls)}>
              {perfOpenLeads > 0 && (
                <PageKpiCard label="فرص مفتوحة" value={String(perfOpenLeads)} icon={<Users />} tone="brand" />
              )}
              {perfUpcomingVisits > 0 && (
                <PageKpiCard label="زيارات قادمة" value={String(perfUpcomingVisits)} icon={<CalendarClock />} tone="neutral" />
              )}
              {perfActiveReservations > 0 && (
                <PageKpiCard label="حجوزات نشطة" value={String(perfActiveReservations)} icon={<BookmarkCheck />} tone="success" />
              )}
              {perfClosed > 0 && (
                <PageKpiCard label="صفقات مغلقة" value={String(perfClosed)} sub={perfClosedLabel} icon={<FileText />} tone="info" />
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
