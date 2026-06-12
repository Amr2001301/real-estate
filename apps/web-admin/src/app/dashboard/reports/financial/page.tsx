import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  FileText, DollarSign, Clock, AlertTriangle,
  CalendarDays, CreditCard, Wallet, ReceiptText,
  CheckCircle2, XCircle, BadgeCheck, Activity, Bookmark, Coins, FileWarning,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api, safe } from '@/lib/api';
import type {
  FinancialDashboard,
  FinancialInstallmentRow,
  FinancialDepositRow,
  DepositType,
  PlanPaymentType,
  Paged,
} from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import {
  resolveReportDateRange,
  resolveComparisonDateRange,
  computeDelta,
  type CompareMode,
  type PeriodMode,
} from '@/lib/report-filter';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { ExportMenu } from '@/components/export-menu';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ReportsTabs } from '../_components/reports-tabs';
import { CashflowBarChart } from './_components/cashflow-bar-chart';
import { PaymentDonutChart } from './_components/payment-donut-chart';
import { ProjectSelect } from './_components/project-select';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Search {
  mode?: string; month?: string; year?: string; quarter?: string;
  dateFrom?: string; dateTo?: string; compare?: string;
  projectId?: string; q?: string; type?: string;
}
interface ProjectOption { id: string; name: { ar: string; en: string } }

// ── Label / class maps ────────────────────────────────────────────────────────
const PAYMENT_TYPE_LABELS: Record<PlanPaymentType, string> = {
  RESERVATION: 'مبلغ الحجز', DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',   FINAL_PAYMENT: 'دفعة أخيرة',
};
const PAYMENT_TYPE_CLS: Record<PlanPaymentType, string> = {
  RESERVATION: 'bg-indigo-100 text-indigo-700', DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',   FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};
const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز', DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',      FINAL_PAYMENT: 'دفعة أخيرة',
};
const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700', DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',       FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};
const AGING_LABELS: Record<string, string> = {
  '1-30': '1–30 يوم', '31-60': '31–60 يوم', '61-90': '61–90 يوم', '90+': '+90 يوم',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function decimal(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function daysOverdue(dueDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000));
}

function getDepositCustomer(d: FinancialDepositRow): string {
  return d.contract?.customer?.fullName ?? d.reservation?.client?.fullName ?? d.reservation?.lead?.fullName ?? '—';
}

function getDepositUnit(d: FinancialDepositRow): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

function buildApiUrl(p: { dateFrom?: string; dateTo?: string; projectId?: string; q?: string; type?: string }): string {
  const params = new URLSearchParams();
  if (p.projectId) params.set('projectId', p.projectId);
  if (p.q)         params.set('q',         p.q);
  if (p.type)      params.set('type',      p.type);
  if (p.dateFrom)  params.set('dateFrom',  p.dateFrom);
  if (p.dateTo)    params.set('dateTo',    p.dateTo);
  const qs = params.toString();
  return `/reports/financial-dashboard${qs ? `?${qs}` : ''}`;
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function SectionDivider({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 text-slate-400 shrink-0">{icon}</span>
      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-hairline" />
    </div>
  );
}

type DeltaShape = { value: string; direction: 'up' | 'down' | 'flat' };

function DeltaChip({ delta, invert }: { delta: DeltaShape; invert?: boolean }) {
  const up   = delta.direction === 'up';
  const down = delta.direction === 'down';
  const isGood = invert ? down : up;
  const isBad  = invert ? up   : down;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 h-4 text-[10px] font-semibold shrink-0',
      isGood && 'bg-success-50 text-success-700',
      isBad  && 'bg-danger-50 text-danger-700',
      delta.direction === 'flat' && 'bg-slate-100 text-slate-500',
    )}>
      <span aria-hidden>{up ? '▲' : down ? '▼' : '•'}</span>
      {delta.value}
    </span>
  );
}

type PrimaryTone = 'brand' | 'success' | 'info' | 'danger';
const TONE_CLS: Record<PrimaryTone, { icon: string; bar: string; val: string }> = {
  brand:   { icon: 'bg-amber-50 text-amber-700',      bar: 'bg-amber-400',    val: 'text-slate-900' },
  success: { icon: 'bg-emerald-50 text-emerald-600',  bar: 'bg-emerald-400',  val: 'text-slate-900' },
  info:    { icon: 'bg-slate-100 text-slate-500',     bar: 'bg-slate-300',    val: 'text-slate-900' },
  danger:  { icon: 'bg-danger-50 text-danger-600',    bar: 'bg-danger-500',   val: 'text-danger-700' },
};

function PrimaryKpiCard({
  label, value, sub, icon, tone = 'brand', delta, invertDelta,
}: {
  label: string; value: ReactNode; sub?: string;
  icon?: ReactNode; tone?: PrimaryTone;
  delta?: DeltaShape; invertDelta?: boolean;
}) {
  const cls = TONE_CLS[tone];
  return (
    <div className="bg-surface rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
      <div className={`h-0.5 ${cls.bar}`} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          {icon && (
            <div className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]',
              cls.icon,
            )}>
              {icon}
            </div>
          )}
          {delta && <DeltaChip delta={delta} invert={invertDelta} />}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 leading-tight uppercase tracking-wide">{label}</p>
          <p className={cn('mt-1 text-[22px] leading-none font-bold tracking-tight tabular-nums whitespace-nowrap', cls.val)}>
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] text-slate-500 leading-tight">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function OverdueTable({ rows }: { rows: FinancialInstallmentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <BadgeCheck className="h-7 w-7 text-slate-200" />
        <p className="text-sm text-slate-400">لا توجد أقساط متأخرة</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[380px]">
      <table className="w-full text-sm min-w-[600px]">
        <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline sticky top-0 z-10">
          <tr>
            <th className="text-start font-semibold py-2.5 ps-5 pe-4">العميل</th>
            <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">رقم العقد</th>
            <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">الوحدة</th>
            <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">النوع</th>
            <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">الاستحقاق</th>
            <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">المبلغ</th>
            <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap">التأخر</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => {
            const c = row.plan.contract;
            const days = daysOverdue(row.dueDate);
            return (
              <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors align-middle">
                <td className="py-2.5 ps-5 pe-4 font-medium text-slate-800 max-w-[160px] truncate">{c.customer.fullName}</td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <Link href={`/dashboard/contracts/${c.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                    {c.contractNumber ?? `#${c.id.slice(0, 8)}`}
                  </Link>
                </td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{c.unit.code}</td>
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', PAYMENT_TYPE_CLS[row.type] ?? 'bg-slate-100 text-slate-600')}>
                    {PAYMENT_TYPE_LABELS[row.type] ?? row.type}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatDate(row.dueDate)}</td>
                <td className="py-2.5 px-4 font-bold tabular-nums whitespace-nowrap text-slate-900" dir="ltr">{formatCurrency(row.amount)}</td>
                <td className="py-2.5 ps-4 pe-5 whitespace-nowrap">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold leading-tight',
                    days > 60 ? 'bg-danger-100 text-danger-700'
                      : days > 30 ? 'bg-red-100 text-red-600'
                      : days > 7  ? 'bg-amber-100 text-amber-700'
                      : 'bg-orange-100 text-orange-600',
                  )}>
                    {days}د
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompactPaymentList({ rows, emptyMessage }: { rows: FinancialInstallmentRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6 text-center">
        <BadgeCheck className="h-6 w-6 text-slate-200" />
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-hairline">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between py-2.5 px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums shrink-0">{formatDate(row.dueDate)}</span>
            <span className="text-sm font-medium text-slate-700 truncate">{row.plan.contract.customer.fullName}</span>
          </div>
          <span className="text-sm font-bold tabular-nums whitespace-nowrap text-slate-900 ms-3" dir="ltr">{formatCurrency(row.amount)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const resolved  = resolveReportDateRange(sp);
  const { dateFrom, dateTo, year, mode, month, quarter } = resolved;
  const compare   = (sp.compare ?? 'none') as CompareMode;
  const cmpRange  = resolveComparisonDateRange(resolved, compare);

  // URL to clear q/type while preserving period+project
  const clearFiltersUrl = (() => {
    const p = new URLSearchParams({ mode, year: String(year) });
    if (mode === 'monthly')   p.set('month',    String(month));
    if (mode === 'quarterly') p.set('quarter',  String(quarter));
    if (mode === 'custom')    { p.set('dateFrom', dateFrom); p.set('dateTo', dateTo); }
    if (compare !== 'none')   p.set('compare',  compare);
    if (sp.projectId)         p.set('projectId', sp.projectId);
    return `/dashboard/reports/financial?${p.toString()}`;
  })();

  // Preserve period+q+type for ProjectSelect navigation
  const preserveForProject: Record<string, string> = {
    mode,
    year: String(year),
    ...(mode === 'monthly'   ? { month:   String(month) }   : {}),
    ...(mode === 'quarterly' ? { quarter: String(quarter) } : {}),
    ...(mode === 'custom'    ? { dateFrom, dateTo }          : {}),
    ...(compare !== 'none'   ? { compare }                   : {}),
    ...(sp.q    ? { q:    sp.q }    : {}),
    ...(sp.type ? { type: sp.type } : {}),
  };

  const [dashRes, cmpDashRes, projectsRes] = await Promise.all([
    safe(api.get<FinancialDashboard>(buildApiUrl({ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }))),
    cmpRange
      ? safe(api.get<FinancialDashboard>(buildApiUrl({ dateFrom: cmpRange.dateFrom, dateTo: cmpRange.dateTo, projectId: sp.projectId, q: sp.q, type: sp.type })))
      : Promise.resolve({ data: null, error: null }),
    safe(api.get<Paged<ProjectOption>>('/projects?pageSize=100')),
  ]);

  const dash     = dashRes.data;
  const s        = dash?.summary;
  const projects = projectsRes.data?.data ?? [];
  const cmpS     = cmpDashRes.data?.summary;

  // Primary financial values (unchanged calculations)
  const collectedVerified    = decimal(s?.totalCollectedVerified ?? s?.totalCollected);
  const collectedAll         = decimal(s?.totalCollectedAll ?? s?.totalCollected);
  const collectedUnverified  = decimal(s?.totalCollectedUnverified ?? String(collectedAll - collectedVerified));
  const outstanding          = decimal(s?.totalOutstanding ?? s?.totalRemaining);
  const overdueComputed      = decimal(s?.overdueAmountComputed ?? s?.totalOverdue);
  const overdueCountComputed = s?.overdueInstallmentCountComputed ?? s?.overdueInstallmentCount ?? 0;
  const dueSoon              = decimal(s?.dueSoonAmount);
  const contractVal          = decimal(s?.totalContractValue);

  // Comparison deltas
  const contractDelta  = cmpS ? computeDelta(contractVal,       decimal(cmpS.totalContractValue)) : undefined;
  const collectedDelta = cmpS ? computeDelta(collectedVerified, decimal(cmpS.totalCollectedVerified ?? cmpS.totalCollected)) : undefined;
  const remainingDelta = cmpS ? computeDelta(outstanding,       decimal(cmpS.totalOutstanding ?? cmpS.totalRemaining)) : undefined;
  const overdueDelta   = cmpS ? computeDelta(overdueComputed,   decimal(cmpS.overdueAmountComputed ?? cmpS.totalOverdue)) : undefined;

  const collectionByType = dash?.collectionByType ?? [];
  const aging            = dash?.aging ?? [];
  const booking          = dash?.booking;
  const liabilities      = dash?.liabilities;
  const docsHealth       = dash?.documentsHealth;
  const hasAdvancedFilters = !!(sp.q || sp.type);

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="التقارير المالية"
        description="تقرير الرقابة المالية — المحصّل، المتبقي، المتأخر، والمستحقات القادمة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير', href: '/dashboard/reports' },
          { label: 'المالي' },
        ]}
        actions={
          <div className="inline-flex items-center gap-1 rounded-xl border border-hairline bg-surface shadow-xs px-1.5 py-1.5">
            <ExportMenu
              label="تصدير"
              xlsxPath="/reports/financial-dashboard/export.xlsx"
              csvPath="/reports/financial-dashboard/export.csv"
              filenameBase="financial-dashboard"
              params={{ dateFrom, dateTo, projectId: sp.projectId, q: sp.q, type: sp.type }}
            />
          </div>
        }
      />

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <ReportsTabs active="financial" />

      {/* ── Period / comparison filter ────────────────────────────────────── */}
      <ReportFilterBar
        defaultMode={mode as PeriodMode}
        defaultMonth={month}
        defaultYear={year}
        defaultQuarter={quarter}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
        defaultCompare={compare}
        basePath="/dashboard/reports/financial"
      />

      {/* ── Advanced filters — project / customer / type ──────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface-muted/50 px-4 py-2.5 shadow-xs">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 hidden sm:inline">فلاتر متقدمة</span>
        <div className="w-px h-4 bg-hairline shrink-0 hidden sm:block" />

        <ProjectSelect
          value={sp.projectId ?? ''}
          projects={projects.map((p) => ({ id: p.id, name: tx(p.name) }))}
          preserveParams={preserveForProject}
        />

        <div className="w-px h-4 bg-hairline shrink-0 hidden sm:block" />

        <form method="get" action="/dashboard/reports/financial" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="mode"  value={mode} />
          <input type="hidden" name="year"  value={String(year)} />
          {mode === 'monthly'   && <input type="hidden" name="month"    value={String(month)} />}
          {mode === 'quarterly' && <input type="hidden" name="quarter"  value={String(quarter)} />}
          {mode === 'custom'    && <input type="hidden" name="dateFrom" value={dateFrom} />}
          {mode === 'custom'    && <input type="hidden" name="dateTo"   value={dateTo} />}
          {compare !== 'none'   && <input type="hidden" name="compare"  value={compare} />}
          {sp.projectId         && <input type="hidden" name="projectId" value={sp.projectId} />}

          <Input
            name="q"
            inputSize="sm"
            placeholder="ابحث باسم العميل"
            defaultValue={sp.q ?? ''}
            className="w-40"
          />
          <Select name="type" inputSize="sm" defaultValue={sp.type ?? ''} className="w-40">
            <option value="">كل الأنواع</option>
            <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
            <option value="DOWN_PAYMENT">دفعة أولى</option>
            <option value="INSTALLMENT">قسط شهري</option>
            <option value="FINAL_PAYMENT">دفعة أخيرة</option>
          </Select>
          <Button type="submit" variant="secondary" size="sm">تطبيق</Button>
          {hasAdvancedFilters && (
            <Link href={clearFiltersUrl}>
              <Button type="button" variant="secondary" size="sm">مسح</Button>
            </Link>
          )}
        </form>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {dashRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {dashRes.error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          1 — Primary KPI cards
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PrimaryKpiCard
          tone="brand" label="إجمالي قيمة العقود" icon={<FileText />}
          value={<span dir="ltr">{formatCurrency(contractVal)}</span>}
          sub={s ? `${s.contractCount} عقد` : undefined}
          delta={contractDelta}
        />
        <PrimaryKpiCard
          tone="success" label="المحصّل المؤكد" icon={<DollarSign />}
          value={<span dir="ltr">{formatCurrency(collectedVerified)}</span>}
          sub={`إجمالي مسجل: ${formatCurrency(collectedAll)} · غير مؤكد: ${formatCurrency(collectedUnverified)}`}
          delta={collectedDelta}
        />
        <PrimaryKpiCard
          tone="info" label="المتبقي للتحصيل" icon={<Clock />}
          value={<span dir="ltr">{formatCurrency(outstanding)}</span>}
          delta={remainingDelta} invertDelta
        />
        <PrimaryKpiCard
          tone="danger" label="المتأخر المحسوب" icon={<AlertTriangle />}
          value={<span dir="ltr">{formatCurrency(overdueComputed)}</span>}
          sub={`${overdueCountComputed.toLocaleString('ar-EG')} قسط · مستحق خلال 7 أيام: ${formatCurrency(dueSoon)}`}
          delta={overdueDelta} invertDelta
        />
      </div>

      {/* Secondary stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'المحصّل هذا الشهر',       value: formatCurrency(s?.collectedThisMonth ?? 0), cls: 'text-success-700', ltr: true },
          { label: 'المستحق هذا الشهر',       value: formatCurrency(s?.dueThisMonth ?? 0),       cls: 'text-amber-600',  ltr: true },
          { label: 'عدد العقود',              value: (s?.contractCount ?? 0).toLocaleString('ar-EG'),              cls: 'text-slate-900', ltr: false },
          { label: 'عدد الدفعات',             value: (s?.depositCount ?? 0).toLocaleString('ar-EG'),               cls: 'text-slate-900', ltr: false },
          { label: 'أقساط متأخرة (محسوبة)', value: overdueCountComputed.toLocaleString('ar-EG'),                   cls: 'text-danger-700', ltr: false },
        ].map((item) => (
          <div key={item.label} className="bg-surface rounded-xl border border-hairline shadow-xs px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 leading-tight">{item.label}</p>
            <p className={cn('text-lg font-bold tabular-nums leading-tight', item.cls)} dir={item.ltr ? 'ltr' : undefined}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2 — Cashflow & Collection Health
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<Activity />} label="التدفق النقدي وصحة التحصيل" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Cashflow trend — 2/3 */}
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">اتجاهات التدفق النقدي</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">المدفوعات والمستحقات خلال الأشهر الستة الماضية</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 shrink-0" />المحصّل
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 shrink-0" />المستحق
              </span>
            </div>
          </CardHeader>
          <CardBody className="px-4 pt-2 pb-4">
            <CashflowBarChart data={dash?.cashflowTrend ?? []} />
          </CardBody>
        </Card>

        {/* Payment status donut — 1/3 */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">تحليل حالة الدفع</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">توزيع قيم العقود</p>
            </div>
          </CardHeader>
          <CardBody className="px-5 py-4 flex flex-col gap-3 flex-1">
            <PaymentDonutChart
              collected={collectedVerified}
              overdue={overdueComputed}
              remaining={outstanding}
              contractValue={contractVal}
            />
            <div className="space-y-2 pt-1">
              {((): { label: string; amount: number; pct: number; dot: string; text: string }[] => {
                const base = contractVal > 0 ? contractVal : collectedVerified + overdueComputed + outstanding || 1;
                return [
                  { label: 'المحصّل المؤكد', amount: collectedVerified, pct: Math.round((collectedVerified / base) * 100), dot: 'bg-emerald-500', text: 'text-success-700' },
                  { label: 'المتأخر',         amount: overdueComputed,   pct: Math.round((overdueComputed   / base) * 100), dot: 'bg-red-500',     text: 'text-danger-700' },
                  { label: 'المتبقي',         amount: outstanding,       pct: Math.round((outstanding       / base) * 100), dot: 'bg-slate-300',   text: 'text-slate-600' },
                ];
              })().map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', r.dot)} />
                    <span className="text-xs font-medium text-slate-600">{r.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-xs font-bold tabular-nums whitespace-nowrap', r.text)} dir="ltr">{formatCurrency(r.amount)}</span>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">{r.pct}٪</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 mt-auto border-t border-hairline">
              <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide font-semibold">إجمالي قيمة العقود</p>
              <p className="text-base font-bold text-slate-900 tabular-nums leading-tight whitespace-nowrap" dir="ltr">{formatCurrency(contractVal)}</p>
              {s && <p className="text-[10px] text-slate-400 mt-0.5">{s.contractCount} عقد</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          3 — Receivables & Overdue Risk
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<AlertTriangle />} label="الذمم المدينة والمتأخرات" />

      {/* Receivables summary tile row */}
      <div className="bg-surface border border-hairline rounded-2xl shadow-xs px-5 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'المتبقي للتحصيل',      value: formatCurrency(outstanding),                               cls: 'text-slate-900' },
            { label: 'مستحق خلال 7 أيام',    value: formatCurrency(dueSoon),                                   cls: 'text-amber-600' },
            { label: 'المتأخر المحسوب',      value: formatCurrency(overdueComputed),                            cls: 'text-danger-700' },
            { label: 'عدد الأقساط المتأخرة', value: overdueCountComputed.toLocaleString('ar-EG'),               cls: 'text-danger-700' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-surface-muted/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 leading-tight">{item.label}</p>
              <p className={cn('text-lg font-bold tabular-nums leading-tight whitespace-nowrap', item.cls)} dir="ltr">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          يتم احتساب المتأخرات بناءً على تاريخ الاستحقاق وحالة السداد، وليس على حالة OVERDUE المخزنة فقط.
        </p>
      </div>

      {/* Aging buckets */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-slate-800">أعمار المتأخرات</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">توزيع المبالغ المتأخرة حسب عمر الدين</p>
          </div>
        </CardHeader>
        <CardBody>
          {aging.length === 0 || aging.every((b) => b.count === 0) ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <BadgeCheck className="h-7 w-7 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد متأخرات</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {aging.map((b) => {
                const isHigh = b.label === '90+' || b.label === '61-90';
                return (
                  <div key={b.label} className={cn(
                    'rounded-xl border px-4 py-3',
                    b.count > 0 && isHigh  ? 'border-danger-200 bg-danger-50/40'
                      : b.count > 0        ? 'border-amber-200 bg-amber-50/30'
                      : 'border-hairline opacity-50',
                  )}>
                    <p className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide mb-1 leading-tight',
                      b.count > 0 ? 'text-slate-500' : 'text-slate-400',
                    )}>
                      {AGING_LABELS[b.label] ?? b.label}
                    </p>
                    <p className={cn(
                      'text-lg font-bold tabular-nums leading-tight whitespace-nowrap',
                      b.count > 0 && isHigh ? 'text-danger-700' : b.count > 0 ? 'text-amber-700' : 'text-slate-400',
                    )} dir="ltr">
                      {formatCurrency(b.amount)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{b.count.toLocaleString('ar-EG')} قسط</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Overdue installments — all rows with scroll */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-danger-100 bg-danger-50/30">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-100 text-danger-600">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-danger-800">الأقساط المتأخرة</CardTitle>
            {overdueCountComputed > 0 && (
              <p className="text-2xs text-danger-600 mt-0.5">{overdueCountComputed} قسط متأخر محسوب</p>
            )}
          </div>
          {s && s.overdueInstallmentCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-danger-100 text-danger-700 text-[11px] font-semibold shrink-0">
              {s.overdueInstallmentCount}
            </span>
          )}
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap shrink-0">
            عرض الكل
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          <OverdueTable rows={dash?.overdue ?? []} />
        </CardBody>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          4 — Upcoming Payments
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<CalendarDays />} label="المستحقات القادمة" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">المستحقات هذا الأسبوع</CardTitle>
            </div>
            {(dash?.upcomingThisWeek?.length ?? 0) > 0 && (
              <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap shrink-0" dir="ltr">
                {formatCurrency((dash?.upcomingThisWeek ?? []).reduce((acc, r) => acc + decimal(r.amount), 0))}
              </span>
            )}
          </CardHeader>
          <CardBody className="p-0 pb-1 min-h-[72px]">
            <CompactPaymentList rows={dash?.upcomingThisWeek ?? []} emptyMessage="لا توجد مستحقات هذا الأسبوع" />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Wallet className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">بقية مستحقات الشهر</CardTitle>
            </div>
            {(dash?.upcomingThisMonth?.length ?? 0) > 0 && (
              <span className="text-xs font-bold tabular-nums text-slate-700 whitespace-nowrap shrink-0" dir="ltr">
                {formatCurrency((dash?.upcomingThisMonth ?? []).reduce((acc, r) => acc + decimal(r.amount), 0))}
              </span>
            )}
          </CardHeader>
          <CardBody className="p-0 pb-1 min-h-[72px]">
            <CompactPaymentList rows={dash?.upcomingThisMonth ?? []} emptyMessage="لا توجد مستحقات إضافية هذا الشهر" />
          </CardBody>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          5 — Collection by payment type
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<CreditCard />} label="التحصيل حسب نوع الدفعة" />

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <CreditCard className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-slate-800">التحصيل حسب نوع الدفعة</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">توزيع الدفعات المسجلة والمؤكدة حسب التصنيف</p>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {collectionByType.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CreditCard className="h-7 w-7 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد دفعات ضمن الفلاتر المختارة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="text-start font-semibold py-2.5 ps-5 pe-4">نوع الدفعة</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">العدد</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">إجمالي مسجل</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">مؤكد</th>
                    <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap">غير مؤكد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {collectionByType.map((c) => (
                    <tr key={c.type} className="hover:bg-surface-muted/40 transition-colors align-middle">
                      <td className="py-2.5 ps-5 pe-4 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', DEPOSIT_TYPE_CLS[c.type] ?? 'bg-slate-100 text-slate-600')}>
                          {DEPOSIT_TYPE_LABELS[c.type] ?? c.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 tabular-nums text-slate-600">{c.count.toLocaleString('ar-EG')}</td>
                      <td className="py-2.5 px-4 tabular-nums font-bold text-slate-900 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalAll)}</td>
                      <td className="py-2.5 px-4 tabular-nums text-success-700 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalVerified)}</td>
                      <td className="py-2.5 ps-4 pe-5 tabular-nums text-amber-600 whitespace-nowrap" dir="ltr">{formatCurrency(c.totalUnverified)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-2.5 text-[11px] text-slate-400 border-t border-hairline">
            المحصّل المؤكد يعتمد على الدفعات التي تم التحقق منها فقط.
          </p>
        </CardBody>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          6 — Liabilities, quality, booking
      ════════════════════════════════════════════════════════════════════ */}
      {(liabilities || docsHealth || booking) && (
        <SectionDivider icon={<Coins />} label="الالتزامات والجودة التشغيلية" />
      )}

      {booking && (
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Bookmark className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">خط الحجوزات</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">الحجوزات ليست إيرادًا تعاقديًا حتى تتحول إلى عقد</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'حجوزات قيد المراجعة', value: `${booking.pendingReservationsCount.toLocaleString('ar-EG')} · ${formatCurrency(booking.pendingReservationsBookingAmount)}`, cls: 'text-amber-600' },
                { label: 'حجوزات معتمدة',       value: `${booking.approvedReservationsCount.toLocaleString('ar-EG')} · ${formatCurrency(booking.approvedReservationsBookingAmount)}`, cls: 'text-slate-900' },
                { label: 'مبالغ الحجز المؤكدة', value: formatCurrency(booking.bookingCollectedVerified), cls: 'text-success-700' },
                { label: 'تقدير غير المحصّل',   value: formatCurrency(booking.bookingUncollectedEstimate), cls: 'text-slate-700' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-surface-muted/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 leading-tight">{item.label}</p>
                  <p className={cn('text-base font-bold tabular-nums leading-tight', item.cls)}>{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">إجمالي مبالغ الحجز المسجلة: {formatCurrency(booking.bookingCollectedAll)}</p>
          </CardBody>
        </Card>
      )}

      {liabilities && (
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Coins className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-semibold text-slate-800">العمولات والالتزامات</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">لا يتم جمع دفعات الوسطاء داخل إجمالي الالتزامات لتجنب العد المزدوج</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'مستحقات المبيعات غير المدفوعة',  value: formatCurrency(liabilities.salesBonus.unpaidAmount),           cls: 'text-amber-600' },
                { label: 'عمولات الوسطاء غير المدفوعة',   value: formatCurrency(liabilities.brokerCommissions.unpaidAmount),     cls: 'text-amber-600' },
                { label: 'إجمالي الالتزامات غير المدفوعة', value: formatCurrency(liabilities.totalUnpaidLiabilities),              cls: 'text-danger-700' },
                { label: 'المدفوع من العمولات', value: formatCurrency(decimal(liabilities.salesBonus.paidAmount) + decimal(liabilities.brokerCommissions.paidAmount)), cls: 'text-success-700' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-surface-muted/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 leading-tight">{item.label}</p>
                  <p className={cn('text-lg font-bold tabular-nums leading-tight whitespace-nowrap', item.cls)} dir="ltr">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[
                {
                  title: 'مستحقات المبيعات',
                  rows: [
                    { label: 'معلّق', amount: liabilities.salesBonus.pendingAmount,  count: liabilities.salesBonus.pendingCount },
                    { label: 'معتمد', amount: liabilities.salesBonus.approvedAmount, count: liabilities.salesBonus.approvedCount },
                    { label: 'مدفوع', amount: liabilities.salesBonus.paidAmount,     count: liabilities.salesBonus.paidCount },
                  ],
                },
                {
                  title: 'عمولات الوسطاء',
                  rows: [
                    { label: 'معلّق',           amount: liabilities.brokerCommissions.pendingAmount,  count: liabilities.brokerCommissions.pendingCount },
                    { label: 'معتمد',           amount: liabilities.brokerCommissions.approvedAmount, count: liabilities.brokerCommissions.approvedCount },
                    { label: 'مدفوع (عبر دفعة)', amount: liabilities.brokerCommissions.paidAmount,   count: liabilities.brokerCommissions.paidCount },
                    { label: 'غير مدفوع',       amount: liabilities.brokerCommissions.unpaidAmount,  count: liabilities.brokerCommissions.unpaidCount },
                  ],
                },
                {
                  title: 'دفعات الوسطاء',
                  rows: [
                    { label: 'مسودة',        amount: liabilities.brokerPayouts.draftAmount,      count: liabilities.brokerPayouts.draftCount },
                    { label: 'معتمدة',       amount: liabilities.brokerPayouts.approvedAmount,   count: liabilities.brokerPayouts.approvedCount },
                    { label: 'قيد المعالجة', amount: liabilities.brokerPayouts.processingAmount, count: liabilities.brokerPayouts.processingCount },
                    { label: 'مدفوعة',       amount: liabilities.brokerPayouts.paidAmount,       count: liabilities.brokerPayouts.paidCount },
                  ],
                },
              ].map((panel) => (
                <div key={panel.title} className="rounded-xl border border-hairline overflow-hidden">
                  <div className="px-4 py-2 bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                    {panel.title}
                  </div>
                  <div className="divide-y divide-hairline">
                    {panel.rows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs text-slate-500">
                          {r.label} <span className="text-slate-300">({r.count.toLocaleString('ar-EG')})</span>
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 whitespace-nowrap" dir="ltr">
                          {formatCurrency(r.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {docsHealth && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-xl border border-hairline bg-surface-muted/50 px-4 py-2.5 shadow-xs hover:bg-surface-muted/80 transition-colors">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FileWarning className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-slate-600 flex-1">سلامة المستندات والإيصالات</span>
            <span className="text-[10px] font-medium text-slate-400 group-open:hidden">عرض</span>
            <span className="text-[10px] font-medium text-slate-400 hidden group-open:inline">إخفاء</span>
          </summary>
          <div className="mt-2">
            <Card className="overflow-hidden">
              <CardBody>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'دفعات مؤكدة بدون إيصال',         entry: docsHealth.depositsMissingReceipt },
                    { label: 'دفعات مؤكدة بدون مستند إيصال',  entry: docsHealth.verifiedDepositsMissingReceiptDocument },
                    { label: 'إيصالات قديمة غير مربوطة',      entry: docsHealth.depositsWithLegacyReceiptUrlMissingDocument },
                    { label: 'عقود موقعة بدون مستند عقد',     entry: docsHealth.signedContractsMissingDocument },
                    { label: 'ملفات عقود قديمة غير مربوطة',  entry: docsHealth.contractsWithLegacyPdfUrlMissingDocument },
                  ].map((item) => (
                    <div key={item.label} className={cn(
                      'rounded-xl border px-4 py-3',
                      item.entry.count > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-hairline opacity-60',
                    )}>
                      <p className="text-[11px] text-slate-500 mb-1.5 leading-tight min-h-[30px]">{item.label}</p>
                      <p className={cn('text-xl font-bold tabular-nums leading-tight', item.entry.count > 0 ? 'text-amber-700' : 'text-slate-400')}>
                        {item.entry.count.toLocaleString('ar-EG')}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap" dir="ltr">{formatCurrency(item.entry.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </details>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          7 — Recent deposits
      ════════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={<ReceiptText />} label="آخر الدفعات" />

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center gap-2.5 px-5 py-3.5 border-b border-hairline">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <ReceiptText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold text-slate-800">آخر الدفعات</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">أحدث الدفعات المسجلة حسب الفلاتر المختارة</p>
          </div>
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap shrink-0">
            عرض الكل
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {(!dash || dash.recentDeposits.length === 0) ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CreditCard className="h-7 w-7 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد دفعات مسجلة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-surface-muted/60 text-2xs font-semibold tracking-wide text-slate-500 border-b border-hairline">
                  <tr>
                    <th className="text-start font-semibold py-2.5 ps-5 pe-4 whitespace-nowrap">النوع</th>
                    <th className="text-start font-semibold py-2.5 px-4">العميل</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">الوحدة</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">المرجع</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">تاريخ الدفع</th>
                    <th className="text-start font-semibold py-2.5 px-4 whitespace-nowrap">المبلغ</th>
                    <th className="text-start font-semibold py-2.5 ps-4 pe-5 whitespace-nowrap">التحقق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {dash.recentDeposits.slice(0, 8).map((d) => (
                    <tr key={d.id} className="hover:bg-surface-muted/40 transition-colors align-middle">
                      <td className="py-2.5 ps-5 pe-4 whitespace-nowrap">
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight', DEPOSIT_TYPE_CLS[d.type] ?? 'bg-slate-100 text-slate-600')}>
                          {DEPOSIT_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800 max-w-[160px] truncate">{getDepositCustomer(d)}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">{getDepositUnit(d)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {d.contract ? (
                          <Link href={`/dashboard/contracts/${d.contract.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                            {d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8)}`}
                          </Link>
                        ) : d.reservation ? (
                          <Link href={`/dashboard/reservations/${d.reservation.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                            {d.reservation.reservationNumber ?? `#${d.reservation.id.slice(0, 8)}`}
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap tabular-nums">{formatDate(d.paidAt)}</td>
                      <td className="py-2.5 px-4 font-bold tabular-nums whitespace-nowrap text-slate-900" dir="ltr">{formatCurrency(d.amount)}</td>
                      <td className="py-2.5 ps-4 pe-5 whitespace-nowrap">
                        {d.verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-700">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />متحقق
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />غير متحقق
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
