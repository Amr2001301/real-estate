import Link from 'next/link';
import { BookmarkCheck, Eye, Briefcase, Phone, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerReservation,
  Broker,
  Paged,
  Project,
  User,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ReservationStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  projectId?: string;
  salesId?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerReservationsPage({
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
  for (const key of ['brokerId', 'status', 'projectId', 'salesId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [resRes, brokersRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerReservation>>(`/broker-reservations?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  const paged = resRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    converted: rows.filter((r) => r.status === 'CONVERTED').length,
    failed: rows.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  };

  // Page-scoped commission total (safely derived from existing row data)
  const totalCommission = rows.reduce(
    (acc, r) => acc + Number(r.commissionLockedAmount ?? 0),
    0,
  );

  const totalReservations = paged?.meta.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="حجوزات من الوسطاء"
        description="حجوزات عملاء نشأت من بوابة الوسيط وتحتاج إلى مراجعة داخلية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'حجوزات من الوسطاء' },
        ]}
        actions={
          <Link href="/dashboard/broker-reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إنشاء حجز نيابة عن وسيط
            </Button>
          </Link>
        }
      />

      {/* Reservation summary strip — page-scoped status counts */}
      {paged && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
          {/* Total — filter-wide count, the most prominent number */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">
              {totalReservations}
            </span>
            <span className="text-2xs font-medium text-slate-400">حجز</span>
          </div>

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Status breakdown — always render all chips so zero counts are visible */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewChip label="قيد المراجعة" count={counts.pending} className="bg-warning-50 text-warning-700" />
            <ReviewChip label="تمت الموافقة" count={counts.approved} className="bg-success-50 text-success-700" />
            <ReviewChip label="محوّل إلى عقد" count={counts.converted} className="bg-info-50 text-info-700" />
            {counts.failed > 0 && (
              <ReviewChip label="مرفوض / ملغي" count={counts.failed} className="bg-danger-50 text-danger-700" />
            )}
          </div>

          {/* Commission total — only if any commission has been locked on this page */}
          {totalCommission > 0 && (
            <>
              <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-slate-400">إجمالي العمولة المقفلة</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">
                  {formatCurrency(totalCommission)}
                </span>
              </div>
            </>
          )}

          <span className="ms-auto text-2xs text-slate-400 hidden sm:inline">في هذه الصفحة</span>
        </div>
      )}

      {resRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الحجوزات: {resRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/broker-reservations"
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
          className="w-44 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">تمت الموافقة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CANCELLED">ملغى</option>
          <option value="EXPIRED">منتهي</option>
          <option value="CONVERTED">محوّل إلى عقد</option>
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
        <Select
          name="salesId"
          inputSize="sm"
          defaultValue={sp.salesId ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل المندوبين</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-reservations">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      {/* Reservation review queue */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم الحجز</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المندوب الداخلي</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الإنشاء</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<BookmarkCheck />}
                      title="لا توجد حجوزات من الوسطاء"
                      description="ستظهر هنا فور إرسال الوسطاء أول حجز."
                      action={
                        <Link href="/dashboard/broker-reservations/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            إنشاء حجز نيابة عن وسيط
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="align-middle hover:bg-surface-muted/40 transition-colors"
                >
                  {/* Reservation number — mono chip */}
                  <td className="py-3.5 ps-5 pe-4">
                    {r.reservationNumber ? (
                      <span
                        className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 leading-none"
                        dir="ltr"
                      >
                        {r.reservationNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Broker */}
                  <td className="py-3.5 px-4">
                    {r.broker ? (
                      <Link
                        href={`/dashboard/brokers/${r.broker.id}` as never}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{r.broker.companyName}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                    {r.brokerAgent && (
                      <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                        {r.brokerAgent.fullName}
                      </p>
                    )}
                  </td>

                  {/* Client */}
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                      {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                    </p>
                    <span
                      className="mt-0.5 inline-flex items-center gap-1 text-2xs text-slate-400"
                      dir="ltr"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {r.lead?.phone ?? r.client?.phone ?? '—'}
                    </span>
                  </td>

                  {/* Unit */}
                  <td className="py-3.5 px-4">
                    {r.unit?.code ? (
                      <span
                        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none"
                        dir="ltr"
                      >
                        {r.unit.code}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                    {r.unit?.building && (
                      <p className="text-2xs text-slate-400 mt-1 truncate max-w-[160px]">
                        {tx(r.unit.building.phase.project.name)}
                      </p>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="py-3.5 px-4">
                    <ReservationStatusBadge status={r.status} />
                  </td>

                  {/* Sales admin */}
                  <td className="py-3.5 px-4">
                    {r.sales ? (
                      <span className="block text-xs text-slate-600 truncate max-w-[140px]">
                        {r.sales.fullName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                        غير معيّن
                      </span>
                    )}
                  </td>

                  {/* Locked commission */}
                  <td className="py-3.5 px-4">
                    {r.commissionLockedPct != null ? (
                      <>
                        <p className="text-xs font-semibold text-slate-800 tabular-nums">
                          {Number(r.commissionLockedPct).toFixed(2)}%
                        </p>
                        {r.commissionLockedAmount != null && (
                          <p className="text-2xs text-slate-400 tabular-nums mt-0.5">
                            {formatCurrency(r.commissionLockedAmount)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                    {formatDate(r.createdAt)}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 ps-4 pe-5">
                    <Link href={`/dashboard/reservations/${r.id}` as never}>
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
            basePath="/dashboard/broker-reservations"
            params={{
              brokerId: sp.brokerId,
              status: sp.status,
              projectId: sp.projectId,
              salesId: sp.salesId,
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
      <span className="font-bold tabular-nums">{count}</span>
    </span>
  );
}
