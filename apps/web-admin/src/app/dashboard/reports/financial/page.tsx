import Link from 'next/link';
import {
  FileText, DollarSign, Clock, AlertTriangle,
  CalendarDays, CreditCard, Wallet, ReceiptText,
  CheckCircle2, XCircle, BadgeCheck, Activity,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  FinancialDashboard,
  FinancialInstallmentRow,
  FinancialDepositRow,
  FinancialSummary,
  DepositType,
  PlanPaymentType,
  Paged,
} from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { ReportsTabs } from '../_components/reports-tabs';
import { ExportButton } from './_components/export-button';
import { ProjectSelect } from './_components/project-select';
import { CashflowBarChart } from './_components/cashflow-bar-chart';
import { PaymentDonutChart } from './_components/payment-donut-chart';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectOption { id: string; name: { ar: string; en: string } }

// ── Label / class maps ────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<PlanPaymentType, string> = {
  RESERVATION: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const PAYMENT_TYPE_CLS: Record<PlanPaymentType, string> = {
  RESERVATION: 'bg-indigo-100 text-indigo-700',
  DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',
  FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700',
  DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',
  FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
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

function buildApiUrl(sp: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (sp.projectId) params.set('projectId', sp.projectId);
  if (sp.q) params.set('q', sp.q);
  if (sp.type) params.set('type', sp.type);
  if (sp.dateFrom) params.set('dateFrom', sp.dateFrom);
  if (sp.dateTo) params.set('dateTo', sp.dateTo);
  const qs = params.toString();
  return `/reports/financial-dashboard${qs ? `?${qs}` : ''}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

type PrimaryTone = 'brand' | 'success' | 'info' | 'danger';

const PRIMARY_TONE: Record<PrimaryTone, { icon: string; bar: string; value: string }> = {
  brand:   { icon: 'bg-brand-50 text-brand-600',    bar: 'bg-brand-500',   value: 'text-slate-900' },
  success: { icon: 'bg-success-50 text-success-600', bar: 'bg-success-500', value: 'text-slate-900' },
  info:    { icon: 'bg-info-50 text-info-600',        bar: 'bg-info-500',    value: 'text-slate-900' },
  danger:  { icon: 'bg-danger-50 text-danger-600',    bar: 'bg-danger-500',  value: 'text-danger-700' },
};

function PrimaryKpiCard({
  label, value, sub, icon, tone = 'brand',
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon?: React.ReactNode; tone?: PrimaryTone;
}) {
  const cls = PRIMARY_TONE[tone];
  return (
    <div className="bg-white rounded-2xl border border-hairline shadow-xs overflow-hidden flex flex-col">
      <div className={`h-0.5 ${cls.bar}`} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        {icon && (
          <div className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]',
            cls.icon,
          )}>
            {icon}
          </div>
        )}
        <div>
          <p className="text-[12px] font-medium text-slate-500 leading-tight uppercase tracking-wide">{label}</p>
          <p className={cn('mt-1 text-[26px] leading-none font-bold tracking-tight tabular-nums', cls.value)}>
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function PeriodLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as never}
      className={cn(
        'px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap',
        active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
      )}
    >
      {children}
    </Link>
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
          <tr>
            <th className="px-4 py-2 text-right font-medium">العميل</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">رقم العقد</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">الوحدة</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">النوع</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">الاستحقاق</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">المبلغ</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">التأخر</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => {
            const c = row.plan.contract;
            const days = daysOverdue(row.dueDate);
            return (
              <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[160px] truncate">
                  {c.customer.fullName}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link
                    href={`/dashboard/contracts/${c.id}`}
                    className="font-mono text-xs text-brand-600 hover:underline"
                  >
                    {c.contractNumber ?? `#${c.id.slice(0, 8)}`}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">{c.unit.code}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                    PAYMENT_TYPE_CLS[row.type] ?? 'bg-slate-100 text-slate-600',
                  )}>
                    {PAYMENT_TYPE_LABELS[row.type] ?? row.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                  {formatDate(row.dueDate)}
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold leading-tight',
                    days > 30 ? 'bg-red-100 text-red-700'
                      : days > 7 ? 'bg-amber-100 text-amber-700'
                      : 'bg-orange-100 text-orange-700',
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

function CompactPaymentList({ rows, emptyMessage }: {
  rows: FinancialInstallmentRow[];
  emptyMessage: string;
}) {
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
            <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums shrink-0">
              {formatDate(row.dueDate)}
            </span>
            <span className="text-sm font-medium text-slate-700 truncate">
              {row.plan.contract.customer.fullName}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-slate-800 ms-3">
            {formatCurrency(row.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  // Period preset date computation
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const monthStartStr = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  const quarterStartStr = `${y}-${String(Math.floor(mo / 3) * 3 + 1).padStart(2, '0')}-01`;
  const yearStartStr = `${y}-01-01`;

  const activePeriod =
    sp.dateFrom === monthStartStr   ? 'month'   :
    sp.dateFrom === quarterStartStr ? 'quarter' :
    sp.dateFrom === yearStartStr    ? 'year'    : null;

  function presetUrl(dateFrom: string): string {
    const p = new URLSearchParams({ dateFrom, dateTo: todayStr });
    if (sp.projectId) p.set('projectId', sp.projectId);
    return `/dashboard/reports/financial?${p.toString()}`;
  }

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      projectId: sp.projectId, q: sp.q, type: sp.type,
      dateFrom: sp.dateFrom, dateTo: sp.dateTo, showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    return `/dashboard/reports/financial?${p.toString()}`;
  }

  const hasAdvancedFilters = !!(sp.q || sp.type || (sp.dateFrom && !activePeriod) || (sp.dateTo && !activePeriod));
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  const preserveForProject: Record<string, string> = {};
  if (sp.dateFrom) preserveForProject.dateFrom = sp.dateFrom;
  if (sp.dateTo)   preserveForProject.dateTo   = sp.dateTo;
  if (sp.q)        preserveForProject.q        = sp.q;
  if (sp.type)     preserveForProject.type     = sp.type;
  if (sp.showFilters) preserveForProject.showFilters = sp.showFilters;

  const [dashRes, projectsRes] = await Promise.all([
    safe(api.get<FinancialDashboard>(buildApiUrl(sp))),
    safe(api.get<Paged<ProjectOption>>('/projects?pageSize=100')),
  ]);

  const dash     = dashRes.data;
  const s        = dash?.summary;
  const projects = projectsRes.data?.data ?? [];

  const collected   = decimal(s?.totalCollected);
  const overdue     = decimal(s?.totalOverdue);
  const remaining   = decimal(s?.totalRemaining);
  const contractVal = decimal(s?.totalContractValue);

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        className="mb-0"
        title="التقارير المالية"
        description="ملخص مالي شامل — المحصّل، المتبقي، المتأخر، والمستحقات القادمة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'التقارير', href: '/dashboard/reports' },
          { label: 'المالي' },
        ]}
      />

      <ReportsTabs active="financial" />

      {/* ── Controls row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border border-hairline bg-white shadow-xs overflow-hidden divide-x divide-x-reverse divide-hairline">
            <PeriodLink href={presetUrl(monthStartStr)} active={activePeriod === 'month'}>
              الشهر الحالي
            </PeriodLink>
            <PeriodLink href={presetUrl(quarterStartStr)} active={activePeriod === 'quarter'}>
              الربع السنوي
            </PeriodLink>
            <PeriodLink href={presetUrl(yearStartStr)} active={activePeriod === 'year'}>
              السنوي
            </PeriodLink>
          </div>

          <ProjectSelect
            value={sp.projectId ?? ''}
            projects={projects.map((p) => ({ id: p.id, name: tx(p.name) }))}
            preserveParams={preserveForProject}
          />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={toggleFiltersUrl as never}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
          </Link>
          <ExportButton />
        </div>
      </div>

      {/* ── Advanced filters ───────────────────────────────────────────────── */}
      {showFilters && (
        <Card>
          <CardBody className="px-5 py-4">
            <form
              method="get"
              action="/dashboard/reports/financial"
              className="flex flex-wrap items-end gap-x-4 gap-y-3"
            >
              {sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}

              <div className="flex flex-col gap-1 min-w-[150px]">
                <label htmlFor="q" className="text-xs font-medium text-slate-500">العميل</label>
                <Input id="q" name="q" inputSize="sm" placeholder="ابحث باسم العميل" defaultValue={sp.q ?? ''} />
              </div>

              <div className="flex flex-col gap-1 min-w-[140px]">
                <label htmlFor="type" className="text-xs font-medium text-slate-500">نوع الدفعة</label>
                <Select id="type" name="type" inputSize="sm" defaultValue={sp.type ?? ''}>
                  <option value="">كل الأنواع</option>
                  <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
                  <option value="DOWN_PAYMENT">دفعة أولى</option>
                  <option value="INSTALLMENT">قسط شهري</option>
                  <option value="FINAL_PAYMENT">دفعة أخيرة</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="dateFrom" className="text-xs font-medium text-slate-500">من تاريخ</label>
                <Input id="dateFrom" name="dateFrom" type="date" inputSize="sm" defaultValue={sp.dateFrom ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="dateTo" className="text-xs font-medium text-slate-500">إلى تاريخ</label>
                <Input id="dateTo" name="dateTo" type="date" inputSize="sm" defaultValue={sp.dateTo ?? ''} />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="sm">تطبيق</Button>
                <Link href="/dashboard/reports/financial">
                  <Button type="button" variant="secondary" size="sm">مسح</Button>
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {dashRes.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{dashRes.error}</div>
      )}

      {/* ── Primary KPIs ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PrimaryKpiCard
          tone="brand"
          label="إجمالي قيمة العقود"
          icon={<FileText />}
          value={formatCurrency(contractVal)}
          sub={s ? `${s.contractCount} عقد` : undefined}
        />
        <PrimaryKpiCard
          tone="success"
          label="إجمالي المحصّل"
          icon={<DollarSign />}
          value={formatCurrency(collected)}
          sub={s ? `${s.depositCount} دفعة` : undefined}
        />
        <PrimaryKpiCard
          tone="info"
          label="إجمالي المتبقي"
          icon={<Clock />}
          value={formatCurrency(remaining)}
        />
        <PrimaryKpiCard
          tone="danger"
          label="إجمالي المتأخر"
          icon={<AlertTriangle />}
          value={formatCurrency(overdue)}
          sub={s ? `${s.overdueInstallmentCount} قسط` : undefined}
        />
      </div>

      {/* ── Analytics row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Cashflow trend chart — 2/3 */}
        <Card className="xl:col-span-2">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">اتجاهات التدفق النقدي</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-emerald-500 shrink-0" />
                المحصّل
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-sm bg-amber-400 shrink-0" />
                المستحق
              </span>
            </div>
          </CardHeader>
          <CardBody className="px-4 pt-2 pb-4">
            <CashflowBarChart data={dash?.cashflowTrend ?? []} />
          </CardBody>
        </Card>

        {/* Payment status donut — 1/3 */}
        <Card className="flex flex-col">
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">تحليل حالة الدفع</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="px-5 py-4 flex flex-col gap-3 flex-1">
            <PaymentDonutChart
              collected={collected}
              overdue={overdue}
              remaining={remaining}
              contractValue={contractVal}
            />
            <div className="space-y-2 pt-1">
              {((): { label: string; amount: number; pct: number; dot: string; text: string }[] => {
                const base = contractVal > 0 ? contractVal : collected + overdue + remaining || 1;
                return [
                  { label: 'المحصّل', amount: collected, pct: Math.round((collected / base) * 100), dot: 'bg-emerald-500', text: 'text-emerald-700' },
                  { label: 'المتأخر', amount: overdue,   pct: Math.round((overdue / base) * 100),   dot: 'bg-red-500',     text: 'text-red-700' },
                  { label: 'المتبقي', amount: remaining,  pct: Math.round((remaining / base) * 100),  dot: 'bg-slate-300',   text: 'text-slate-600' },
                ];
              })().map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', r.dot)} />
                    <span className="text-xs text-slate-500">{r.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-xs font-semibold tabular-nums', r.text)}>
                      {formatCurrency(r.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{r.pct}٪</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 mt-auto border-t border-hairline">
              <p className="text-[10px] text-slate-400 mb-0.5">إجمالي قيمة العقود</p>
              <p className="text-base font-bold text-slate-800 tabular-nums leading-tight">
                {formatCurrency(contractVal)}
              </p>
              {s && <p className="text-[10px] text-slate-400 mt-0.5">{s.contractCount} عقد</p>}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Secondary stats strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'المحصّل هذا الشهر',  value: formatCurrency(s?.collectedThisMonth ?? 0), cls: 'text-emerald-600' },
          { label: 'المستحق هذا الشهر',  value: formatCurrency(s?.dueThisMonth ?? 0),       cls: 'text-amber-600' },
          { label: 'عدد العقود',          value: (s?.contractCount ?? 0).toLocaleString('ar-EG'),             cls: 'text-slate-800' },
          { label: 'عدد الدفعات',         value: (s?.depositCount ?? 0).toLocaleString('ar-EG'),              cls: 'text-slate-800' },
          { label: 'أقساط متأخرة',        value: (s?.overdueInstallmentCount ?? 0).toLocaleString('ar-EG'),  cls: 'text-red-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-hairline shadow-xs px-4 py-3.5">
            <p className="text-[11px] text-slate-400 mb-1 leading-tight">{item.label}</p>
            <p className={cn('text-lg font-bold tabular-nums leading-tight', item.cls)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ── Overdue installments (max 5) ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5 bg-red-50/60 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <CardTitle className="text-sm text-red-700">الأقساط المتأخرة</CardTitle>
            {s && s.overdueInstallmentCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">
                {s.overdueInstallmentCount}
              </span>
            )}
          </div>
          {dash && dash.overdue.length > 0 && (
            <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap">
              عرض الكل
            </Link>
          )}
        </CardHeader>
        <CardBody className="p-0">
          <OverdueTable rows={(dash?.overdue ?? []).slice(0, 5)} />
        </CardBody>
      </Card>

      {/* ── Upcoming payments — compact lists ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">المستحقات هذا الأسبوع</CardTitle>
            </div>
            {(dash?.upcomingThisWeek?.length ?? 0) > 0 && (
              <span className="text-xs font-semibold tabular-nums text-slate-600">
                {formatCurrency(
                  (dash?.upcomingThisWeek ?? []).reduce((acc, r) => acc + decimal(r.amount), 0)
                )}
              </span>
            )}
          </CardHeader>
          <CardBody className="p-0 pb-1">
            <CompactPaymentList
              rows={(dash?.upcomingThisWeek ?? []).slice(0, 6)}
              emptyMessage="لا توجد مستحقات هذا الأسبوع"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-500 shrink-0" />
              <CardTitle className="text-sm">بقية مستحقات الشهر</CardTitle>
            </div>
            {(dash?.upcomingThisMonth?.length ?? 0) > 0 && (
              <span className="text-xs font-semibold tabular-nums text-slate-600">
                {formatCurrency(
                  (dash?.upcomingThisMonth ?? []).reduce((acc, r) => acc + decimal(r.amount), 0)
                )}
              </span>
            )}
          </CardHeader>
          <CardBody className="p-0 pb-1">
            <CompactPaymentList
              rows={(dash?.upcomingThisMonth ?? []).slice(0, 6)}
              emptyMessage="لا توجد مستحقات إضافية هذا الشهر"
            />
          </CardBody>
        </Card>
      </div>

      {/* ── Recent deposits (max 8) ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">آخر الدفعات</CardTitle>
          </div>
          <Link href="/dashboard/deposits" className="text-xs text-brand-600 hover:underline whitespace-nowrap">
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
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">النوع</th>
                    <th className="px-4 py-2 text-right font-medium">العميل</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">الوحدة</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">المرجع</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2 text-right font-medium whitespace-nowrap">التحقق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {dash.recentDeposits.slice(0, 8).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                          DEPOSIT_TYPE_CLS[d.type] ?? 'bg-slate-100 text-slate-600',
                        )}>
                          {DEPOSIT_TYPE_LABELS[d.type] ?? d.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[160px] truncate">
                        {getDepositCustomer(d)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {getDepositUnit(d)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {d.contract ? (
                          <Link
                            href={`/dashboard/contracts/${d.contract.id}`}
                            className="font-mono text-xs text-brand-600 hover:underline"
                          >
                            {d.contract.contractNumber ?? `#${d.contract.id.slice(0, 8)}`}
                          </Link>
                        ) : d.reservation ? (
                          <Link
                            href={`/dashboard/reservations/${d.reservation.id}`}
                            className="font-mono text-xs text-indigo-600 hover:underline"
                          >
                            {d.reservation.reservationNumber ?? `#${d.reservation.id.slice(0, 8)}`}
                          </Link>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap tabular-nums">
                        {formatDate(d.paidAt)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                        {formatCurrency(d.amount)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {d.verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            متحقق
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            غير متحقق
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
