import Link from 'next/link';
import { Plus, BookmarkCheck, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalReservation } from '@/lib/types';
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
  status?: string;
  projectId?: string;
}

const PAGE_SIZE = 20;

export default async function PortalReservationsPage({
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
  if (sp.status) qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);

  const [resRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<PortalReservation>>(`/portal/reservations?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
  ]);

  const paged = resRes.data;
  const rows = paged?.data ?? [];
  const projects = projectsRes.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="حجوزاتي"
        description="الحجوزات التي قمت بإنشائها عبر البوابة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الحجوزات' },
        ]}
        actions={
          <Link href="/portal/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              حجز جديد
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
        action="/portal/reservations"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
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
          className="w-56 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.status || sp.projectId) && (
            <Link href="/portal/reservations">
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
                <th className="text-start font-semibold py-3 px-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المندوب</th>
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
                      title="لا توجد حجوزات بعد"
                      description="أنشئ أول حجز من فرصة معتمدة على وحدة متاحة."
                      action={
                        <Link href="/portal/reservations/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            حجز جديد
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
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">
                    {r.reservationNumber ?? '—'}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-900">{r.lead?.fullName ?? '—'}</p>
                    <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                      {r.lead?.phone ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-mono text-2xs text-slate-700" dir="ltr">
                    {r.unit?.code ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {r.unit?.building ? tx(r.unit.building.phase.project.name) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <ReservationStatusBadge status={r.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {r.sales?.fullName ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {r.commissionLockedPct !== null && r.commissionLockedPct !== undefined
                      ? `${Number(r.commissionLockedPct).toFixed(2)}%`
                      : null}
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
                    <Link href={`/portal/reservations/${r.id}` as never}>
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
            basePath="/portal/reservations"
            params={{ status: sp.status, projectId: sp.projectId }}
          />
        )}
      </Card>
    </div>
  );
}
