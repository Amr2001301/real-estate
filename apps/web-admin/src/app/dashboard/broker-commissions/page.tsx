import Link from 'next/link';
import { BadgePercent, Eye, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerCommission,
  Broker,
  Paged,
  Project,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerCommissionStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of ['brokerId', 'status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerCommission>>(`/broker-commissions?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = commRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  // Page-scoped financial totals
  const totalNet = rows.reduce((acc, r) => acc + Number(r.netAmount ?? 0), 0);
  const totalGross = rows.reduce((acc, r) => acc + Number(r.grossAmount ?? 0), 0);

  const totalCommissions = paged?.meta.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="عمولات الوسطاء"
        description="عمولات تُحتسب تلقائيًا عند توقيع عقود ناتجة عن الوسطاء، وتتطلب اعتماد الإدارة قبل الدفع."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عمولات الوسطاء' },
        ]}
      />

      {/* Commission approval summary strip — page-scoped counts + financial totals */}
      {paged && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
          {/* Total — filter-wide count */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">
              {totalCommissions}
            </span>
            <span className="text-2xs font-medium text-slate-400">عمولة</span>
          </div>

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Status breakdown — all 4 always rendered so zero counts are visible */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewChip label="قيد المراجعة" count={counts.pending} className="bg-warning-50 text-warning-700" />
            <ReviewChip label="موافق عليها" count={counts.approved} className="bg-success-50 text-success-700" />
            {counts.rejected > 0 && (
              <ReviewChip label="مرفوضة" count={counts.rejected} className="bg-danger-50 text-danger-700" />
            )}
            {counts.cancelled > 0 && (
              <ReviewChip label="ملغاة" count={counts.cancelled} className="bg-slate-100 text-slate-500" />
            )}
          </div>

          {/* Financial totals — net is the approval-critical number */}
          {totalGross > 0 && (
            <>
              <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-2xs text-slate-400 whitespace-nowrap">إجمالي الصافي</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap" dir="ltr">
                  {formatCurrency(totalNet)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-2xs text-slate-400 whitespace-nowrap">الإجمالي قبل الخصم</span>
                <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
                  {formatCurrency(totalGross)}
                </span>
              </div>
            </>
          )}

          <span className="ms-auto text-2xs text-slate-400 hidden sm:inline">في هذه الصفحة</span>
        </div>
      )}

      {commRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العمولات: {commRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/broker-commissions"
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
            <option key={b.id} value={b.id}>
              {b.companyName}
            </option>
          ))}
        </Select>
        <Select
          name="status"
          inputSize="sm"
          defaultValue={sp.status ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">موافق عليها</option>
          <option value="REJECTED">مرفوضة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <Select
          name="projectId"
          inputSize="sm"
          defaultValue={sp.projectId ?? ''}
          className="w-40 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
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
            <Link href="/dashboard/broker-commissions">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      {/* Commission approval queue */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم العمولة</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">العقد</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الأساس</th>
                <th className="text-start font-semibold py-3 px-4">النسبة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الاستحقاق</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-0">
                    <EmptyState
                      icon={<BadgePercent />}
                      title="لا توجد عمولات بعد"
                      description="تُنشأ العمولات تلقائيًا عند توقيع عقد ناتج عن وسيط. لا يتم إنشاؤها يدويًا."
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="align-middle hover:bg-surface-muted/40 transition-colors"
                >
                  {/* Commission number — mono chip */}
                  <td className="py-3 ps-5 pe-4">
                    <span
                      className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                      dir="ltr"
                    >
                      {c.commissionNumber}
                    </span>
                  </td>

                  {/* Broker — company primary + agent secondary */}
                  <td className="py-3 px-4">
                    {c.broker ? (
                      <Link
                        href={`/dashboard/brokers/${c.broker.id}` as never}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{c.broker.companyName}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                    {c.brokerAgent && (
                      <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                        {c.brokerAgent.fullName}
                      </p>
                    )}
                  </td>

                  {/* Contract — mono chip link + reservation secondary */}
                  <td className="py-3 px-4">
                    {c.contract?.contractNumber ? (
                      <Link
                        href={`/dashboard/contracts/${c.contractId}` as never}
                        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap hover:bg-slate-200 transition-colors"
                        dir="ltr"
                      >
                        {c.contract.contractNumber}
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/contracts/${c.contractId}` as never}
                        className="text-xs text-slate-500 hover:text-brand-700 transition-colors"
                      >
                        —
                      </Link>
                    )}
                    {c.reservation?.reservationNumber && (
                      <p className="text-2xs text-slate-400 mt-0.5 font-mono whitespace-nowrap" dir="ltr">
                        {c.reservation.reservationNumber}
                      </p>
                    )}
                  </td>

                  {/* Unit / Project — code chip + project muted */}
                  <td className="py-3 px-4">
                    {c.unit?.code ? (
                      <span
                        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                        dir="ltr"
                      >
                        {c.unit.code}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                    {c.project && (
                      <p className="text-2xs text-slate-400 mt-1 truncate max-w-[160px]">
                        {tx(c.project.name)}
                      </p>
                    )}
                  </td>

                  {/* Basis amount — weakest financial value, muted context */}
                  <td className="py-3 px-4">
                    <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.basisAmount)}
                    </span>
                  </td>

                  {/* Commission percentage — compact */}
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium text-slate-600 tabular-nums">
                      {c.commissionPct != null
                        ? `${Number(c.commissionPct).toFixed(2)}%`
                        : '—'}
                    </span>
                  </td>

                  {/* Gross amount — intermediate financial value */}
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.grossAmount)}
                    </span>
                  </td>

                  {/* Net amount — strongest, the approval-critical payout figure */}
                  <td className="py-3 px-4">
                    <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.netAmount)}
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="py-3 px-4">
                    <BrokerCommissionStatusBadge status={c.status} />
                  </td>

                  {/* Due date — muted, does not compete with financial values */}
                  <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                    {formatDate(c.earnedAt)}
                  </td>

                  {/* Action */}
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/dashboard/broker-commissions/${c.id}` as never}>
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
            basePath="/dashboard/broker-commissions"
            params={{
              brokerId: sp.brokerId,
              status: sp.status,
              projectId: sp.projectId,
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
