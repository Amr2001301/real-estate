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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Lead, Reservation, VisitAppointment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

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

const SOURCE_LABEL: Record<EntrySource, string> = {
  MANUAL: 'يدوي',
  CONTRACT_AUTO: 'تلقائي من عقد',
};
const SOURCE_CLS: Record<EntrySource, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  CONTRACT_AUTO: 'bg-info-100 text-info-700',
};
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

function pctLabel(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('ar-EG')}%`;
}

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: 'معلق',
  APPROVED: 'معتمد',
  PAID: 'مدفوع',
};
const STATUS_CLS: Record<EntryStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-info-100 text-info-700',
  PAID: 'bg-success-100 text-success-700',
};

function SectionError() {
  return (
    <div className="flex items-start gap-2 text-warning-700 text-sm p-4">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>تعذّر تحميل هذا القسم.</p>
    </div>
  );
}

export default async function MyCompensationPage() {
  const session = await getSession();
  const nowIso = new Date().toISOString();

  // This is a strictly PERSONAL self-view. SALES is self-scoped by the token
  // regardless, but a SALES_MANAGER is a sales actor whose unscoped reads return
  // self + team — so we explicitly pass salesId=<own id> on every self-scopable
  // read to narrow a manager to their OWN data (own id is always in scope).
  // Harmless for SALES (the API ignores the param and still self-scopes).
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
            // NOTE: for a SALES_MANAGER the visits list endpoint overrides
            // assignedSalesId with self+team scope, so this list may include team
            // visits. It is only a fallback proxy — the upcoming-visits KPI below
            // prefers the self-scoped performance figure. TODO: a self-only visits
            // filter for managers if this list is ever displayed directly here.
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

  // Realized performance, scoped to the caller's OWN row (salesId=<own id>) so a
  // SALES_MANAGER sees personal figures here, not team aggregates. Fetch the
  // current month for the summary plus each period present in the targets.
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
    entries
      .filter((e) => e.status === s)
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const pendingTotal = sumByStatus('PENDING');
  const approvedTotal = sumByStatus('APPROVED');
  const paidTotal = sumByStatus('PAID');

  // Fallback proxy metrics (used only if the performance endpoint failed) —
  // computed from the self-scoped lists. Converted reservations stand in for
  // signed contracts in the fallback path.
  const openLeads = leads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length;
  const activeReservations = reservations.filter(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  ).length;
  const convertedDeals = reservations.filter((r) => r.status === 'CONVERTED').length;

  // Prefer endpoint figures; fall back to the proxy values when unavailable.
  const perfOpenLeads = currentPerf?.openLeadsCount ?? openLeads;
  const perfUpcomingVisits = currentPerf?.upcomingVisitsCount ?? upcomingVisits.length;
  const perfActiveReservations = currentPerf?.activeReservationsCount ?? activeReservations;
  const perfClosed = currentPerf?.signedContractsCount ?? convertedDeals;
  const perfClosedLabel = currentPerf ? 'عقود موقّعة هذا الشهر' : 'حجوزات محوّلة (تقديري)';

  return (
    <div className="space-y-5">
      <PageHeader
        title="مستحقاتي وأهدافي"
        description={
          session?.role === 'SALES_MANAGER'
            ? 'بياناتك الشخصية كمندوب مبيعات، منفصلة عن أداء الفريق. للعرض فقط.'
            : 'عرض خاص بك لمستحقات العمولات والمكافآت، وأهداف المبيعات، وملخّص أدائك. للعرض فقط.'
        }
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مستحقاتي وأهدافي' },
        ]}
      />

      {/* ── A. Compensation summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PageKpiCard label="إجمالي المعلق" value={formatCurrency(pendingTotal)} icon={<Clock />} tone="warning" />
        <PageKpiCard label="إجمالي المعتمد" value={formatCurrency(approvedTotal)} icon={<CheckCircle2 />} tone="info" />
        <PageKpiCard label="إجمالي المدفوع" value={formatCurrency(paidTotal)} icon={<Banknote />} tone="success" />
        <PageKpiCard label="عدد المستحقات" value={entries.length.toLocaleString('ar-EG')} icon={<Hash />} tone="brand" />
      </div>

      {/* ── B. My compensation entries ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">مستحقاتي</CardTitle>
          </div>
          {!bonusRes.error && (
            <span className="text-xs text-slate-400 tabular-nums">
              {entries.length.toLocaleString('ar-EG')} مستحق
            </span>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {bonusRes.error ? (
            <SectionError />
          ) : entries.length === 0 ? (
            <EmptyState icon={<Wallet />} title="لا توجد مستحقات حتى الآن" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الفترة</th>
                    <th className="px-4 py-2.5 text-right font-medium">القاعدة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المصدر</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{e.period}</td>
                      <td className="px-4 py-2.5 text-slate-600">{e.rule?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', SOURCE_CLS[e.source ?? 'MANUAL'])}>
                          {SOURCE_LABEL[e.source ?? 'MANUAL']}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', STATUS_CLS[e.status])}>
                          {STATUS_LABEL[e.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(e.paidAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── C. My targets ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">أهدافي</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {targetsRes.error ? (
            <SectionError />
          ) : targets.length === 0 ? (
            <EmptyState icon={<Target />} title="لا توجد أهداف محدّدة بعد" className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الشهر</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف القيمة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المحقق (قيمة)</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">نسبة تحقيق القيمة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">هدف الوحدات</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المحقق (وحدات)</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">نسبة تحقيق الوحدات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {targets.map((t) => {
                    const perf = perfByPeriod.get(t.period);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap">{t.period}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">{formatCurrency(t.amountTarget)}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-slate-700">{perf ? formatCurrency(perf.achievedAmount) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-slate-600">{perf ? pctLabel(perf.targetAmountPercent) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-slate-600 tabular-nums whitespace-nowrap">{t.unitsTarget.toLocaleString('ar-EG')}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-slate-700">{perf ? perf.achievedUnits.toLocaleString('ar-EG') : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 tabular-nums whitespace-nowrap text-slate-600">{perf ? pctLabel(perf.targetUnitsPercent) : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── D. Performance summary ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <CardTitle className="text-sm">ملخّص أدائي</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <PageKpiCard
              label="فرصي المفتوحة"
              value={currentPerf || !leadsRes.error ? perfOpenLeads : '—'}
              icon={<Users />}
              tone="brand"
            />
            <PageKpiCard
              label="زياراتي القادمة"
              value={currentPerf || !visitsRes.error ? perfUpcomingVisits : '—'}
              icon={<CalendarClock />}
              tone="neutral"
            />
            <PageKpiCard
              label="حجوزاتي النشطة"
              value={currentPerf || !reservationsRes.error ? perfActiveReservations : '—'}
              icon={<BookmarkCheck />}
              tone="success"
            />
            <PageKpiCard
              label="صفقاتي"
              value={currentPerf || !reservationsRes.error ? perfClosed : '—'}
              sub={perfClosedLabel}
              icon={<FileText />}
              tone="info"
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
