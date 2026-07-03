import Link from 'next/link';
import {
  DollarSign, CreditCard, Landmark, Hash,
  SlidersHorizontal, ReceiptText, Search,
  ExternalLink, Plus, AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { PagedDeposits, Deposit, DepositType, Paged } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

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
  BOOKING_AMOUNT: 'bg-info-50 text-info-700',
  DOWN_PAYMENT:   'bg-brand-50 text-brand-700',
  INSTALLMENT:    'bg-slate-100 text-slate-600',
  FINAL_PAYMENT:  'bg-success-50 text-success-700',
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
  if (sp.reviewStatus) params.set('reviewStatus', sp.reviewStatus);
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();
  // Registering + verifying deposits are admin/finance actions; SALES is read-only.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
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
      type: sp.type, reviewStatus: sp.reviewStatus, projectId: sp.projectId, q: sp.q,
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
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="الدفعات"
        description="متابعة الدفعات والتحصيلات المرتبطة بالعقود والعملاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات' },
        ]}
        actions={
          isAdmin ? (
            <Link href="/dashboard/deposits/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                تسجيل دفعة
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي المحصّل',
            value: totals ? formatCurrency(totals.totalAmount, currency) : '—',
            icon: <DollarSign />,
            tone: 'brand',
            primary: true,
            sub: totals ? `${totals.count} دفعة` : undefined,
          },
          {
            label: 'مبالغ الحجز',
            value: totals ? formatCurrency(totals.bookingAmount, currency) : '—',
            icon: <Landmark />,
            tone: 'info',
          },
          {
            label: 'الأقساط الشهرية',
            value: totals ? formatCurrency(totals.installment, currency) : '—',
            icon: <CreditCard />,
            tone: 'neutral',
          },
          {
            label: 'عدد الدفعات',
            value: totals?.count ?? 0,
            icon: <Hash />,
            tone: 'success',
            sub: 'إجمالي الدفعات المسجلة',
          },
        ]}
      />

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/deposits">
        {/* Hidden inputs: preserve active advanced filter values when only quick filters are submitted */}
        {!showFilters && sp.ref        && <input type="hidden" name="ref"        value={sp.ref} />}
        {!showFilters && sp.paidAtFrom && <input type="hidden" name="paidAtFrom" value={sp.paidAtFrom} />}
        {!showFilters && sp.paidAtTo   && <input type="hidden" name="paidAtTo"   value={sp.paidAtTo} />}
        {!showFilters && sp.dueDateFrom && <input type="hidden" name="dueDateFrom" value={sp.dueDateFrom} />}
        {!showFilters && sp.dueDateTo  && <input type="hidden" name="dueDateTo"  value={sp.dueDateTo} />}
        {!showFilters && sp.verified   && <input type="hidden" name="verified"   value={sp.verified} />}

        {/* Type */}
        <PremiumFilterField label="نوع الدفعة" htmlFor="dep-type">
          <Select id="dep-type" name="type" inputSize="sm" defaultValue={sp.type ?? ''} className="w-36 shrink-0">
            <option value="">كل الأنواع</option>
            <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
            <option value="DOWN_PAYMENT">دفعة أولى</option>
            <option value="INSTALLMENT">قسط شهري</option>
            <option value="FINAL_PAYMENT">دفعة أخيرة</option>
          </Select>
        </PremiumFilterField>

        {/* Review status */}
        <PremiumFilterField label="حالة المراجعة" htmlFor="dep-reviewStatus">
          <Select id="dep-reviewStatus" name="reviewStatus" inputSize="sm" defaultValue={sp.reviewStatus ?? ''} className="w-40 shrink-0">
            <option value="">كل حالات المراجعة</option>
            <option value="PENDING_REVIEW">قيد المراجعة</option>
            <option value="APPROVED">معتمد</option>
            <option value="REJECTED">مرفوض</option>
            <option value="NO_PROOF">بدون إثبات</option>
          </Select>
        </PremiumFilterField>

        {/* Project */}
        <PremiumFilterField label="المشروع" htmlFor="dep-projectId">
          <Select id="dep-projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Search — grows to fill available space */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="dep-q" className="sr-only">بحث</label>
          <Input
            id="dep-q"
            name="q"
            inputSize="sm"
            placeholder="ابحث باسم العميل أو رقم العقد أو الحجز"
            defaultValue={sp.q ?? ''}
            leftAddon={<Search />}
            className="w-full"
          />
        </div>

        {/* Action buttons — before advanced panel so they stay in row 1 */}
        <div className="flex items-center gap-2 shrink-0">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          <Link href="/dashboard/deposits">
            <Button type="button" variant="secondary" size="sm">إعادة تعيين</Button>
          </Link>
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors',
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700',
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

        {/* Advanced filters — basis-full forces row 2 */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
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
      </PremiumFilterBar>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {depositsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{depositsRes.error}</p>
        </div>
      )}

      {/* ── Deposits table ───────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<ReceiptText />}
        title="سجل الدفعات"
        padded={false}
        trailing={
          deposits ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {deposits.meta.total.toLocaleString('ar-EG')} دفعة
            </span>
          ) : undefined
        }
      >
        {!deposits || deposits.data.length === 0 ? (
          <PremiumEmptyState
            icon={<CreditCard />}
            title="لا توجد دفعات"
            description="لا توجد دفعات تطابق الفلاتر المختارة"
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 px-4 whitespace-nowrap">نوع الدفعة</th>
                  <th className="text-start py-3 px-4">العميل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوحدة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">المرجع</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الاستحقاق</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">المبلغ</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الدفع</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الإيصال</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">التحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {deposits.data.map((d) => {
                  const dueDate = getDueDate(d);
                  return (
                    <tr key={d.id} className="hover:bg-canvas/40 transition-colors duration-100">

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {isAdmin ? (
                          <Link
                            href={`/dashboard/deposits/${d.id}`}
                            className={cn(
                              'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight hover:opacity-80 transition-opacity',
                              DEPOSIT_TYPE_CLS[d.type as DepositType] ?? 'bg-slate-100 text-slate-600',
                            )}
                            title="تفاصيل الدفعة"
                          >
                            {DEPOSIT_TYPE_LABELS[d.type as DepositType] ?? d.type}
                          </Link>
                        ) : (
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[11px] font-medium leading-tight',
                            DEPOSIT_TYPE_CLS[d.type as DepositType] ?? 'bg-slate-100 text-slate-600',
                          )}>
                            {DEPOSIT_TYPE_LABELS[d.type as DepositType] ?? d.type}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[160px] truncate">
                        {getCustomerName(d)}
                      </td>

                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {getUnitCode(d)}
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {d.contractId && d.contract ? (
                          <Link
                            href={`/dashboard/contracts/${d.contractId}`}
                            className="font-mono text-xs text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                          >
                            {d.contract.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                          </Link>
                        ) : d.reservationId && d.reservation ? (
                          <Link
                            href={`/dashboard/reservations/${d.reservationId}`}
                            className="font-mono text-xs text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
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
                        {formatCurrency(d.amount, currency)}
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
                        {isAdmin ? (
                          <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} />
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              d.verified
                                ? 'bg-success-100 text-success-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {d.verified ? 'متحقق' : 'غير متحقق'}
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {deposits && deposits.meta.total > pageSize && (
        <Pagination
          basePath="/dashboard/deposits"
          page={page}
          pageSize={pageSize}
          total={deposits.meta.total}
          params={{
            type: sp.type,
            reviewStatus: sp.reviewStatus,
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
