import Link from 'next/link';
import {
  DollarSign, CreditCard, Landmark, Hash,
  SlidersHorizontal, ReceiptText, Search,
  ExternalLink,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PagedDeposits, Deposit, DepositType, Paged } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProjectOption { id: string; name: { ar: string; en: string } }

// ── Maps ──────────────────────────────────────────────────────────────────────

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT:   'دفعة أولى',
  INSTALLMENT:    'قسط شهري',
  FINAL_PAYMENT:  'دفعة أخيرة',
};

const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700',
  DOWN_PAYMENT:   'bg-amber-100 text-amber-700',
  INSTALLMENT:    'bg-slate-100 text-slate-600',
  FINAL_PAYMENT:  'bg-purple-100 text-purple-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCustomerName(d: Deposit): string {
  if (d.contract?.customer?.fullName) return d.contract.customer.fullName;
  if (d.reservation?.client?.fullName) return d.reservation.client.fullName;
  if (d.reservation?.lead?.fullName) return d.reservation.lead.fullName;
  return '—';
}

function getUnitCode(d: Deposit): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

function getDueDate(d: Deposit): string | null {
  if (d.installment?.dueDate) return d.installment.dueDate;
  if (d.type === 'BOOKING_AMOUNT' && d.reservation) {
    return d.reservation.expiresAt ?? d.reservation.createdAt ?? null;
  }
  return null;
}

function getDueDateTitle(d: Deposit): string | undefined {
  if (d.type === 'BOOKING_AMOUNT') {
    return d.reservation?.expiresAt ? 'موعد انتهاء الحجز' : 'مستحق عند الحجز';
  }
  return undefined;
}

function buildApiUrl(sp: Record<string, string | undefined>, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (sp.type) params.set('type', sp.type);
  if (sp.projectId) params.set('projectId', sp.projectId);
  if (sp.q) params.set('q', sp.q);
  if (sp.ref) params.set('ref', sp.ref);
  if (sp.paidAtFrom) params.set('paidAtFrom', sp.paidAtFrom);
  if (sp.paidAtTo) params.set('paidAtTo', sp.paidAtTo);
  if (sp.dueDateFrom) params.set('dueDateFrom', sp.dueDateFrom);
  if (sp.dueDateTo) params.set('dueDateTo', sp.dueDateTo);
  if (sp.verified) params.set('verified', sp.verified);
  return `/deposits?${params.toString()}`;
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

type SummaryTone = 'brand' | 'success' | 'info' | 'neutral';

const SUMMARY_BAR:  Record<SummaryTone, string> = {
  brand:   'bg-brand-500',
  success: 'bg-success-500',
  info:    'bg-info-500',
  neutral: 'bg-slate-300',
};
const SUMMARY_ICON: Record<SummaryTone, string> = {
  brand:   'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-600',
  info:    'bg-info-50 text-info-600',
  neutral: 'bg-slate-100 text-slate-600',
};

function SummaryCard({
  label, value, sub, icon, tone = 'brand',
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon?: React.ReactNode; tone?: SummaryTone;
}) {
  return (
    <div className="bg-white rounded-2xl border border-hairline shadow-xs overflow-hidden">
      <div className={cn('h-0.5', SUMMARY_BAR[tone])} />
      <div className="px-4 py-4 flex items-start gap-3">
        {icon && (
          <div className={cn(
            'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 shrink-0 [&_svg]:h-4 [&_svg]:w-4',
            SUMMARY_ICON[tone],
          )}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400 leading-tight uppercase tracking-wide">{label}</p>
          <p className="mt-0.5 text-xl leading-tight font-bold tracking-tight tabular-nums text-slate-900 truncate">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;

  // Advanced filter state
  const hasAdvancedFilters = !!(
    sp.ref || sp.paidAtFrom || sp.paidAtTo || sp.dueDateFrom || sp.dueDateTo || sp.verified
  );
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';

  // URL builder for the advanced toggle link (preserves all active params)
  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      type: sp.type, projectId: sp.projectId, q: sp.q,
      ref: sp.ref, paidAtFrom: sp.paidAtFrom, paidAtTo: sp.paidAtTo,
      dueDateFrom: sp.dueDateFrom, dueDateTo: sp.dueDateTo,
      verified: sp.verified, showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const qs = p.toString();
    return `/dashboard/deposits${qs ? `?${qs}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  const [depositsRes, projectsRes] = await Promise.all([
    safe(api.get<PagedDeposits>(buildApiUrl(sp, page, pageSize))),
    safe(api.get<Paged<ProjectOption>>('/projects?pageSize=100')),
  ]);

  const deposits = depositsRes.data;
  const totals   = deposits?.totals;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="الدفعات"
        description="سجل جميع الدفعات المالية على الحجوزات والعقود."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات' },
        ]}
        actions={
          <Link
            href="/dashboard/deposits/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 transition-colors shadow-xs"
          >
            + تسجيل دفعة
          </Link>
        }
      />

      {/* ── 4 primary KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          tone="brand"
          label="إجمالي المحصّل"
          icon={<DollarSign />}
          value={totals ? formatCurrency(totals.totalAmount) : '—'}
          sub={totals ? `${totals.count} دفعة` : undefined}
        />
        <SummaryCard
          tone="info"
          label="مبالغ الحجز"
          icon={<Landmark />}
          value={totals ? formatCurrency(totals.bookingAmount) : '—'}
        />
        <SummaryCard
          tone="neutral"
          label="الأقساط الشهرية"
          icon={<CreditCard />}
          value={totals ? formatCurrency(totals.installment) : '—'}
        />
        <SummaryCard
          tone="success"
          label="عدد الدفعات"
          icon={<Hash />}
          value={totals ? totals.count.toLocaleString('ar-EG') : '—'}
          sub="إجمالي الدفعات المسجلة"
        />
      </div>

      {/* ── Quick filter strip ──────────────────────────────────────────────── */}
      <form method="get" action="/dashboard/deposits">
        {/* Hidden inputs: preserve active advanced filter values when only quick filters are submitted */}
        {!showFilters && sp.ref        && <input type="hidden" name="ref"        value={sp.ref} />}
        {!showFilters && sp.paidAtFrom && <input type="hidden" name="paidAtFrom" value={sp.paidAtFrom} />}
        {!showFilters && sp.paidAtTo   && <input type="hidden" name="paidAtTo"   value={sp.paidAtTo} />}
        {!showFilters && sp.dueDateFrom && <input type="hidden" name="dueDateFrom" value={sp.dueDateFrom} />}
        {!showFilters && sp.dueDateTo  && <input type="hidden" name="dueDateTo"  value={sp.dueDateTo} />}
        {!showFilters && sp.verified   && <input type="hidden" name="verified"   value={sp.verified} />}

        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-hairline shadow-xs px-3 py-2.5">

          {/* Type */}
          <Select name="type" inputSize="sm" defaultValue={sp.type ?? ''} className="w-36 shrink-0">
            <option value="">كل الأنواع</option>
            <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
            <option value="DOWN_PAYMENT">دفعة أولى</option>
            <option value="INSTALLMENT">قسط شهري</option>
            <option value="FINAL_PAYMENT">دفعة أخيرة</option>
          </Select>

          {/* Project */}
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>

          {/* Unified search */}
          <div className="flex-1 min-w-[180px]">
            <Input
              name="q"
              inputSize="sm"
              placeholder="ابحث باسم العميل أو رقم العقد أو الحجز"
              defaultValue={sp.q ?? ''}
              leftAddon={<Search />}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            <Link href="/dashboard/deposits">
              <Button type="button" variant="secondary" size="sm">إعادة تعيين</Button>
            </Link>
          </div>

          {/* Divider + advanced toggle */}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors',
              showFilters
                ? 'text-brand-600'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </Link>
        </div>

        {/* ── Advanced filters (collapsed by default) ──────────────────────── */}
        {showFilters && (
          <div className="mt-2 rounded-xl border border-hairline bg-white shadow-xs px-4 py-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

              <div className="flex flex-col gap-1">
                <label htmlFor="paidAtFrom" className="text-[11px] font-medium text-slate-400">تاريخ الدفع من</label>
                <Input id="paidAtFrom" name="paidAtFrom" type="date" inputSize="sm" defaultValue={sp.paidAtFrom ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="paidAtTo" className="text-[11px] font-medium text-slate-400">تاريخ الدفع إلى</label>
                <Input id="paidAtTo" name="paidAtTo" type="date" inputSize="sm" defaultValue={sp.paidAtTo ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="dueDateFrom" className="text-[11px] font-medium text-slate-400">الاستحقاق من</label>
                <Input id="dueDateFrom" name="dueDateFrom" type="date" inputSize="sm" defaultValue={sp.dueDateFrom ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="dueDateTo" className="text-[11px] font-medium text-slate-400">الاستحقاق إلى</label>
                <Input id="dueDateTo" name="dueDateTo" type="date" inputSize="sm" defaultValue={sp.dueDateTo ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="ref" className="text-[11px] font-medium text-slate-400">رقم المرجع</label>
                <Input id="ref" name="ref" inputSize="sm" placeholder="رقم العقد أو الحجز" defaultValue={sp.ref ?? ''} />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="verified" className="text-[11px] font-medium text-slate-400">التحقق</label>
                <Select id="verified" name="verified" inputSize="sm" defaultValue={sp.verified ?? ''}>
                  <option value="">الكل</option>
                  <option value="true">متحقق</option>
                  <option value="false">غير متحقق</option>
                </Select>
              </div>

            </div>
          </div>
        )}
      </form>

      {depositsRes.error && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm border border-red-100">
          {depositsRes.error}
        </div>
      )}

      {/* ── Deposits table ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-brand-500 shrink-0" />
            <CardTitle className="text-sm">سجل الدفعات</CardTitle>
          </div>
          {deposits && (
            <span className="text-xs text-slate-400 tabular-nums">
              {deposits.meta.total.toLocaleString('ar-EG')} دفعة
            </span>
          )}
        </CardHeader>
        <CardBody className="p-0">
          {!deposits || deposits.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CreditCard className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">لا توجد دفعات تطابق الفلاتر المختارة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-xs text-slate-400 border-b border-hairline">
                  <tr>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">نوع الدفعة</th>
                    <th className="px-4 py-2.5 text-right font-medium">العميل</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الوحدة</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المرجع</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الاستحقاق</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">تاريخ الدفع</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">الإيصال</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">التحقق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {deposits.data.map((d) => {
                    const dueDate = getDueDate(d);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                            DEPOSIT_TYPE_CLS[d.type as DepositType] ?? 'bg-slate-100 text-slate-600',
                          )}>
                            {DEPOSIT_TYPE_LABELS[d.type as DepositType] ?? d.type}
                          </span>
                        </td>

                        <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[160px] truncate">
                          {getCustomerName(d)}
                        </td>

                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {getUnitCode(d)}
                        </td>

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {d.contractId && d.contract ? (
                            <Link
                              href={`/dashboard/contracts/${d.contractId}`}
                              className="font-mono text-xs text-brand-600 hover:underline"
                            >
                              {d.contract.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                            </Link>
                          ) : d.reservationId && d.reservation ? (
                            <Link
                              href={`/dashboard/reservations/${d.reservationId}`}
                              className="font-mono text-xs text-indigo-600 hover:underline"
                            >
                              {d.reservation.reservationNumber ?? `#${d.reservationId.slice(0, 8)}`}
                            </Link>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {dueDate ? (
                            <span className="text-xs text-slate-500 tabular-nums" title={getDueDateTitle(d)}>
                              {formatDate(dueDate)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap text-slate-800">
                          {formatCurrency(d.amount)}
                        </td>

                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDate(d.paidAt)}
                        </td>

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {d.receiptUrl ? (
                            <a
                              href={d.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              عرض
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} />
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {deposits && deposits.meta.total > pageSize && (
        <Pagination
          basePath="/dashboard/deposits"
          page={page}
          pageSize={pageSize}
          total={deposits.meta.total}
          params={{
            type: sp.type,
            projectId: sp.projectId,
            q: sp.q,
            ref: sp.ref,
            paidAtFrom: sp.paidAtFrom,
            paidAtTo: sp.paidAtTo,
            dueDateFrom: sp.dueDateFrom,
            dueDateTo: sp.dueDateTo,
            verified: sp.verified,
          }}
        />
      )}
    </div>
  );
}
