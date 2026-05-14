import Link from 'next/link';
import { Plus, BookmarkCheck, Clock, CheckCircle2, XCircle, CalendarX2, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, Reservation } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

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
    safe(api.get<{ data: SalesUser[] }>('/users?role=SALES&pageSize=100')),
  ]);

  const stats = statsRes.data;
  const reservations = reservationsRes.data?.data ?? [];
  const paginationMeta = reservationsRes.data?.meta;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];
  const salesOptions: SalesUser[] = salesRes.data?.data ?? [];

  return (
    <div className="space-y-6 pb-2">
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
        <KpiCard
          label="إجمالي الحجوزات"
          value={stats?.total ?? '—'}
          icon={<BookmarkCheck className="h-5 w-5" />}
          tone="neutral"
        />
        <KpiCard
          label="قيد المراجعة"
          value={stats?.pending ?? '—'}
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
        />
        <KpiCard
          label="تمت الموافقة"
          value={stats?.approved ?? '—'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          label="مرفوضة"
          value={stats?.rejected ?? '—'}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
        <KpiCard
          label="منتهية / ملغاة"
          value={(stats?.expired ?? 0) + (stats?.cancelled ?? 0)}
          icon={<CalendarX2 className="h-5 w-5" />}
          tone="info"
        />
      </div>

      {/* Filters */}
      <FilterBar method="get" action="/dashboard/reservations">
        <FilterField label="بحث" htmlFor="filter-q">
          <Input
            id="filter-q"
            name="q"
            defaultValue={sp.q}
            placeholder="اسم العميل أو رقم الحجز…"
            inputSize="sm"
          />
        </FilterField>
        <FilterField label="الحالة" htmlFor="filter-status">
          <Select id="filter-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
            <option value="">الكل</option>
            <option value="PENDING">قيد المراجعة</option>
            <option value="APPROVED">تمت الموافقة</option>
            <option value="REJECTED">مرفوض</option>
            <option value="CANCELLED">ملغي</option>
            <option value="EXPIRED">منتهي</option>
          </Select>
        </FilterField>
        <FilterField label="المشروع" htmlFor="filter-project">
          <Select
            id="filter-project"
            name="projectId"
            inputSize="sm"
            defaultValue={sp.projectId ?? ''}
          >
            <option value="">الكل</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.name)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="المندوب" htmlFor="filter-sales">
          <Select
            id="filter-sales"
            name="salesId"
            inputSize="sm"
            defaultValue={sp.salesId ?? ''}
          >
            <option value="">الكل</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="من تاريخ" htmlFor="filter-from">
          <Input
            id="filter-from"
            name="dateFrom"
            type="date"
            defaultValue={sp.dateFrom}
            inputSize="sm"
          />
        </FilterField>
        <FilterField label="إلى تاريخ" htmlFor="filter-to">
          <Input
            id="filter-to"
            name="dateTo"
            type="date"
            defaultValue={sp.dateTo}
            inputSize="sm"
          />
        </FilterField>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          <Link href="/dashboard/reservations">
            <Button type="button" variant="outline" size="sm">
              إعادة تعيين
            </Button>
          </Link>
        </div>
      </FilterBar>

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
                className="font-mono text-xs text-brand-700 hover:underline"
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
