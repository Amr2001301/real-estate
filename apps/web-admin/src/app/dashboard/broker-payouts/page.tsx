import Link from 'next/link';
import { Wallet, Plus, Eye, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AdminBrokerPayout, Broker, Paged } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerPayoutStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدفوعات الوسطاء"
        description="دفعات عمولات معتمدة تصرفها الشركة للوسطاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'مدفوعات الوسطاء' },
        ]}
        actions={
          <Link href="/dashboard/broker-payouts/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              دفعة جديدة
            </Button>
          </Link>
        }
      />

      {/* Payout summary strip — page-scoped counts and financial totals */}
      {paged && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
          {/* Total — filter-wide count */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">
              {totalPayouts}
            </span>
            <span className="text-2xs font-medium text-slate-400">دفعة</span>
          </div>

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Status breakdown */}
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.draft > 0 && (
              <ReviewChip label="مسودة" count={counts.draft} className="bg-slate-100 text-slate-500" />
            )}
            {counts.approved > 0 && (
              <ReviewChip label="موافق عليها" count={counts.approved} className="bg-info-50 text-info-700" />
            )}
            {counts.processing > 0 && (
              <ReviewChip label="قيد التنفيذ" count={counts.processing} className="bg-warning-50 text-warning-700" />
            )}
            <ReviewChip label="مدفوعة" count={counts.paid} className="bg-success-50 text-success-700" />
            {counts.cancelled > 0 && (
              <ReviewChip label="ملغاة" count={counts.cancelled} className="bg-slate-100 text-slate-400" />
            )}
          </div>

          {/* Financial totals */}
          {totalNetPaid > 0 && (
            <>
              <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-2xs text-slate-400 whitespace-nowrap">إجمالي المدفوع</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap" dir="ltr">
                  {formatCurrency(totalNetPaid)}
                </span>
              </div>
            </>
          )}
          {totalNetPending > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-2xs text-slate-400 whitespace-nowrap">قيد الصرف</span>
              <span className="text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap" dir="ltr">
                {formatCurrency(totalNetPending)}
              </span>
            </div>
          )}

          <span className="ms-auto text-2xs text-slate-400 hidden sm:inline">في هذه الصفحة</span>
        </div>
      )}

      {payoutsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المدفوعات: {payoutsRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/broker-payouts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Select
          name="brokerId"
          inputSize="sm"
          defaultValue={sp.brokerId ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.companyName}</option>
          ))}
        </Select>
        <Select
          name="status"
          inputSize="sm"
          defaultValue={sp.status ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="DRAFT">مسودة</option>
          <option value="APPROVED">موافق عليها</option>
          <option value="PROCESSING">قيد التنفيذ</option>
          <option value="PAID">مدفوعة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <Input
          name="period"
          inputSize="sm"
          placeholder="الفترة (مثال: 2026-05)"
          dir="ltr"
          defaultValue={sp.period ?? ''}
          className="w-44 shrink-0"
        />
        <Input
          name="from"
          inputSize="sm"
          type="date"
          defaultValue={sp.from ?? ''}
          className="w-36 shrink-0"
        />
        <Input
          name="to"
          inputSize="sm"
          type="date"
          defaultValue={sp.to ?? ''}
          className="w-36 shrink-0"
        />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-payouts">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      {/* Payout batch registry table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم الدفعة</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">الفترة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الإنشاء</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الصرف</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<Wallet />}
                      title="لا توجد مدفوعات بعد"
                      description="أنشئ أول دفعة بعد اعتماد عمولات الوسطاء."
                      action={
                        <Link href="/dashboard/broker-payouts/new">
                          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                            دفعة جديدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="align-middle hover:bg-surface-muted/40 transition-colors"
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

                  {/* Gross amount — readable but secondary to net */}
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(p.totalGross)}
                    </span>
                  </td>

                  {/* Net amount — strongest payout figure */}
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(p.totalNet)}
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="py-3 px-4">
                    <BrokerPayoutStatusBadge status={p.status} />
                  </td>

                  {/* Creation date — muted */}
                  <td className="py-3 px-4 text-2xs text-slate-400 whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>

                  {/* Paid date — neutral chip fallback when missing */}
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
            }}
          />
        )}
      </Card>
    </div>
  );
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function ReviewChip({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
      <span className="font-bold tabular-nums">{count}</span>
    </span>
  );
}
