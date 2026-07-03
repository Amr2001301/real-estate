import Link from 'next/link';
import { Wallet, Plus, Eye, Briefcase, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerPayout, Broker, Paged } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerPayoutStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['brokerId', 'status', 'period', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [payoutsRes, brokersRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerPayout>>(`/broker-payouts?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
  ]);

  const paged = payoutsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    draft: rows.filter((r) => r.status === 'DRAFT').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    processing: rows.filter((r) => r.status === 'PROCESSING').length,
    paid: rows.filter((r) => r.status === 'PAID').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  // Page-scoped financial totals
  const totalNetPaid = rows
    .filter((r) => r.status === 'PAID')
    .reduce((acc, r) => acc + Number(r.totalNet ?? 0), 0);
  const totalNetPending = rows
    .filter((r) => r.status === 'APPROVED' || r.status === 'PROCESSING')
    .reduce((acc, r) => acc + Number(r.totalNet ?? 0), 0);

  const totalPayouts = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.period || sp.from || sp.to);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      period: sp.period,
      from: sp.from,
      to: sp.to,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-payouts${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="مدفوعات الوسطاء"
        description="إدارة مدفوعات الوسطاء ومراجعة عمليات الصرف."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'مدفوعات الوسطاء' },
        ]}
        actions={
          <Link href={'/dashboard/broker-payouts/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              دفعة جديدة
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي المدفوعات',
            value: totalPayouts,
            icon: <Wallet />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'مدفوعة',
            value: counts.paid,
            icon: <Wallet />,
            tone: 'success',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'إجمالي المدفوع',
            value: totalNetPaid > 0 ? formatCurrency(totalNetPaid, currency) : '—',
            icon: <Wallet />,
            tone: 'neutral',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'قيد الصرف',
            value: totalNetPending > 0 ? formatCurrency(totalNetPending, currency) : '—',
            icon: <Wallet />,
            tone: 'warning',
            sub: 'في هذه الصفحة',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {payoutsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل المدفوعات: {payoutsRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-payouts">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status && <input type="hidden" name="status" value={sp.status} />}
        {!showFilters && sp.period && <input type="hidden" name="period" value={sp.period} />}
        {!showFilters && sp.from   && <input type="hidden" name="from"   value={sp.from} />}
        {!showFilters && sp.to     && <input type="hidden" name="to"     value={sp.to} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label="الوسيط" htmlFor="bpay-broker">
          <Select id="bpay-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
            <option value="">كل الوسطاء</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Action buttons — BEFORE the basis-full panel so ms-auto keeps them in row 1 */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {hasAnyFilter && (
            <Link href={'/dashboard/broker-payouts' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700'
            }`}
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

        {/* ── Row 2: advanced panel (basis-full forces a new flex row) ─────── */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-status" className="text-[11px] font-medium text-slate-400">الحالة</label>
                <Select id="bpay-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">كل الحالات</option>
                  <option value="DRAFT">مسودة</option>
                  <option value="APPROVED">موافق عليها</option>
                  <option value="PROCESSING">قيد التنفيذ</option>
                  <option value="PAID">مدفوعة</option>
                  <option value="CANCELLED">ملغاة</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-period" className="text-[11px] font-medium text-slate-400">الفترة</label>
                <Input
                  id="bpay-period"
                  name="period"
                  inputSize="sm"
                  placeholder="مثال: 2026-05"
                  dir="ltr"
                  defaultValue={sp.period ?? ''}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-from" className="text-[11px] font-medium text-slate-400">التاريخ من</label>
                <Input id="bpay-from" name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bpay-to" className="text-[11px] font-medium text-slate-400">التاريخ إلى</label>
                <Input id="bpay-to" name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Payouts table ────────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<Wallet />}
        title="سجل المدفوعات"
        description="دفعات عمولات معتمدة تصرفها الشركة للوسطاء."
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {totalPayouts.toLocaleString('ar-EG')} دفعة
          </span>
        }
      >
        {rows.length === 0 && !payoutsRes.error ? (
          <PremiumEmptyState
            icon={<Wallet />}
            title="لا توجد مدفوعات بعد"
            description="أنشئ أول دفعة بعد اعتماد عمولات الوسطاء."
            action={
              <Link href={'/dashboard/broker-payouts/new' as never}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  دفعة جديدة
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم الدفعة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوسيط</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الفترة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">إجمالي</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">صافي</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الإنشاء</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الصرف</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="align-middle hover:bg-canvas/40 transition-colors duration-100"
                  >
                    {/* Payout number — mono chip */}
                    <td className="py-3 ps-5 pe-4">
                      <span
                        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                        dir="ltr"
                      >
                        {p.payoutNumber}
                      </span>
                    </td>

                    {/* Broker — company primary */}
                    <td className="py-3 px-4">
                      {p.broker ? (
                        <Link
                          href={`/dashboard/brokers/${p.broker.id}` as never}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                        >
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{p.broker.companyName}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Period — compact mono chip */}
                    <td className="py-3 px-4">
                      {p.period ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                          dir="ltr"
                        >
                          {p.period}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          غير محدد
                        </span>
                      )}
                    </td>

                    {/* Gross amount */}
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(p.totalGross, currency)}
                      </span>
                    </td>

                    {/* Net amount — strongest payout figure */}
                    <td className="py-3 px-4">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(p.totalNet, currency)}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-4">
                      <BrokerPayoutStatusBadge status={p.status} />
                    </td>

                    {/* Creation date */}
                    <td className="py-3 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </td>

                    {/* Paid date */}
                    <td className="py-3 px-4">
                      {p.paidAt ? (
                        <span className="text-2xs text-slate-500 whitespace-nowrap">
                          {formatDate(p.paidAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          لم تُصرف بعد
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/dashboard/broker-payouts/${p.id}` as never}>
                        <IconButton label="عرض" variant="ghost" size="sm">
                          <Eye />
                        </IconButton>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {paged && paged.meta.total > PAGE_SIZE && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/broker-payouts"
          params={{
            brokerId: sp.brokerId,
            status: sp.status,
            period: sp.period,
            from: sp.from,
            to: sp.to,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
