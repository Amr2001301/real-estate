import Link from 'next/link';
import { Plus, BookmarkCheck, Clock, CheckCircle2, XCircle, CalendarX2, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Reservation } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { salesActorLabel } from '@/lib/sales-actor';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/table';
import { ReservationStatusBadge, ReservationBookingPaymentBadge } from '@/components/badges';
import { ReservationActions } from './_components/reservation-actions';

export const dynamic = 'force-dynamic';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
}

interface ProjectOption {
  id: string;
  name: { ar: string; en: string };
}

interface SalesUser {
  id: string;
  fullName: string;
  role?: 'SALES' | 'SALES_MANAGER';
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    projectId?: string;
    salesId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
    showFilters?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const hasAdvancedFilters = !!(sp.salesId || sp.dateFrom || sp.dateTo);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      status: sp.status, projectId: sp.projectId, q: sp.q,
      salesId: sp.salesId, dateFrom: sp.dateFrom, dateTo: sp.dateTo,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const qs = p.toString();
    return `/dashboard/reservations${qs ? `?${qs}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.status) qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.salesId) qs.set('salesId', sp.salesId);
  if (sp.q) qs.set('q', sp.q);
  if (sp.dateFrom) qs.set('dateFrom', sp.dateFrom);
  if (sp.dateTo) qs.set('dateTo', sp.dateTo);

  const [statsRes, reservationsRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Stats>('/reservations/stats')),
    safe(api.get<Paged<Reservation>>(`/reservations?${qs}`)),
    safe(api.get<{ data: ProjectOption[] }>('/projects?pageSize=100')),
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
  ]);

  const stats = statsRes.data;
  const reservations = reservationsRes.data?.data ?? [];
  const paginationMeta = reservationsRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الحجوزات"
        description="مراجعة وإدارة طلبات الحجز المرتبطة بالوحدات والعملاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الحجوزات' },
        ]}
        actions={
          <Link href="/dashboard/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إنشاء حجز جديد
            </Button>
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي الحجوزات"
          value={stats?.total ?? '—'}
          icon={<BookmarkCheck className="h-5 w-5" />}
          tone="neutral"
        />
        <PageKpiCard
          label="قيد المراجعة"
          value={stats?.pending ?? '—'}
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
        />
        <PageKpiCard
          label="تمت الموافقة"
          value={stats?.approved ?? '—'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <PageKpiCard
          label="مرفوضة"
          value={stats?.rejected ?? '—'}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
        <PageKpiCard
          label="منتهية / ملغاة"
          value={(stats?.expired ?? 0) + (stats?.cancelled ?? 0)}
          icon={<CalendarX2 className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* Filter strip */}
      <form method="get" action="/dashboard/reservations">
        {!showFilters && sp.salesId  && <input type="hidden" name="salesId"  value={sp.salesId} />}
        {!showFilters && sp.dateFrom && <input type="hidden" name="dateFrom" value={sp.dateFrom} />}
        {!showFilters && sp.dateTo   && <input type="hidden" name="dateTo"   value={sp.dateTo} />}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-white px-3 py-2.5 shadow-soft">
          <Input
            name="q"
            inputSize="sm"
            defaultValue={sp.q ?? ''}
            placeholder="اسم العميل أو رقم الحجز…"
            className="flex-1 min-w-[160px]"
          />
          <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
            <option value="">كل الحالات</option>
            <option value="PENDING">قيد المراجعة</option>
            <option value="APPROVED">تمت الموافقة</option>
            <option value="REJECTED">مرفوض</option>
            <option value="CANCELLED">ملغي</option>
            <option value="EXPIRED">منتهي</option>
          </Select>
          <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
          <div className="flex items-center gap-1.5 ms-auto">
            <Button type="submit" variant="primary" size="sm">تصفية</Button>
            {(sp.q || sp.status || sp.projectId || hasAdvancedFilters) && (
              <Link href="/dashboard/reservations">
                <Button type="button" variant="ghost" size="sm">مسح</Button>
              </Link>
            )}
          </div>
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs font-semibold shrink-0 transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
                : 'bg-white border-hairline text-slate-600 hover:border-brand-200 hover:text-brand-700'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">!</span>
            )}
          </Link>
        </div>

        {showFilters && (
          <div className="mt-2 rounded-2xl border border-hairline bg-white shadow-soft px-4 py-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">المندوب</label>
                <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">الكل</option>
                  {salesOptions.map((s) => (
                    <option key={s.id} value={s.id}>{salesActorLabel(s)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">من تاريخ</label>
                <Input name="dateFrom" type="date" inputSize="sm" defaultValue={sp.dateFrom ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">إلى تاريخ</label>
                <Input name="dateTo" type="date" inputSize="sm" defaultValue={sp.dateTo ?? ''} />
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Error */}
      {reservationsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{reservationsRes.error}</p>
        </div>
      )}

      {/* Table */}
      <DataTable
        rowKey={(r) => r.id}
        rows={reservations}
        emptyMessage="لا توجد حجوزات"
        columns={[
          {
            key: 'number',
            header: 'رقم الحجز',
            cell: (r) => (
              <Link
                href={`/dashboard/reservations/${r.id}`}
                title="عرض تفاصيل الحجز"
                className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
              >
                {r.reservationNumber ?? r.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: 'client',
            header: 'العميل',
            cell: (r) => {
              const name = r.client?.fullName ?? r.lead?.fullName ?? '—';
              const phone = r.client?.phone ?? r.lead?.phone ?? '';
              return (
                <div>
                  <p className="font-medium text-slate-900">{name}</p>
                  {phone && <p className="text-xs text-slate-500">{phone}</p>}
                </div>
              );
            },
          },
          {
            key: 'project',
            header: 'المشروع / الوحدة',
            cell: (r) => {
              const project = r.unit?.building?.phase?.project;
              return (
                <div>
                  <p>{project ? tx(project.name) : '—'}</p>
                  {r.unit && <p className="text-xs text-slate-500">وحدة: {r.unit.code}</p>}
                </div>
              );
            },
          },
          {
            key: 'sales',
            header: 'المندوب',
            cell: (r) => r.sales?.fullName ?? '—',
          },
          {
            key: 'booking',
            header: 'مبلغ الحجز',
            cell: (r) => {
              const amount = Number(r.bookingAmount);
              return (
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-800" dir="ltr">
                    {Number.isFinite(amount)
                      ? `${amount.toLocaleString('ar-SA')} ر.س`
                      : '—'}
                  </span>
                  <ReservationBookingPaymentBadge status={r.bookingPaymentStatus} />
                </div>
              );
            },
          },
          {
            key: 'status',
            header: 'الحالة',
            cell: (r) => <ReservationStatusBadge status={r.status} />,
          },
          {
            key: 'expires',
            header: 'تاريخ الانتهاء',
            cell: (r) => <span className="text-xs">{formatDateTime(r.expiresAt)}</span>,
          },
          {
            key: 'created',
            header: 'تاريخ الإنشاء',
            cell: (r) => formatDate(r.createdAt),
          },
          {
            key: 'actions',
            header: '',
            cell: (r) => <ReservationActions reservation={r} />,
          },
        ]}
      />

      {/* Pagination */}
      {paginationMeta && paginationMeta.totalPages > 1 && (
        <Pagination
          page={paginationMeta.page}
          pageSize={paginationMeta.pageSize}
          total={paginationMeta.total}
          basePath="/dashboard/reservations"
          params={sp}
        />
      )}
    </div>
  );
}
