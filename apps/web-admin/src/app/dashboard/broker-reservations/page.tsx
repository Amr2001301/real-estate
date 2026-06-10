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
    safe(
      api.get<Paged<AdminBrokerReservation>>(`/broker-reservations?${qs.toString()}`),
    ),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  const paged = resRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

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

      {resRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الحجوزات: {resRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-reservations"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Select name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.companyName}
            </option>
          ))}
        </Select>
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-44 shrink-0">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">تمت الموافقة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CANCELLED">ملغى</option>
          <option value="EXPIRED">منتهي</option>
          <option value="CONVERTED">محوّل إلى عقد</option>
        </Select>
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
        <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-44 shrink-0">
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم الحجز</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المندوب الداخلي</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={<BookmarkCheck />}
                      title="لا توجد حجوزات من الوسطاء"
                      description="ستظهر هنا فور إرسال الوسطاء أول حجز."
                    />
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors align-top"
                >
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">
                    {r.reservationNumber ?? '—'}
                  </td>
                  <td className="py-3 px-4">
                    {r.broker ? (
                      <Link
                        href={`/dashboard/brokers/${r.broker.id}` as never}
                        className="text-sm text-slate-900 hover:text-brand-700 inline-flex items-center gap-1.5"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        {r.broker.companyName}
                      </Link>
                    ) : (
                      '—'
                    )}
                    {r.brokerAgent && (
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {r.brokerAgent.fullName}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900">
                      {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {r.lead?.phone ?? r.client?.phone ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">
                      {r.unit?.code ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {r.unit?.building ? tx(r.unit.building.phase.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <ReservationStatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {r.sales?.fullName ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {r.commissionLockedPct !== null && r.commissionLockedPct !== undefined && (
                      <p>{Number(r.commissionLockedPct).toFixed(2)}%</p>
                    )}
                    {r.commissionLockedAmount !== null &&
                      r.commissionLockedAmount !== undefined && (
                        <p className="text-2xs text-slate-500 mt-0.5">
                          {formatCurrency(r.commissionLockedAmount)}
                        </p>
                      )}
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5">
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
