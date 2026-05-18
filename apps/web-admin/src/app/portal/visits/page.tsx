import Link from 'next/link';
import { Plus, CalendarClock, Phone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalVisitRequest } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  VisitRequestStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  requestStatus?: string;
}

const PAGE_SIZE = 20;

export default async function PortalVisitsPage({
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
  if (sp.requestStatus) qs.set('requestStatus', sp.requestStatus);

  const r = await safe(api.get<Paged<PortalVisitRequest>>(`/portal/visits?${qs.toString()}`));
  const paged = r.data;
  const rows = paged?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="زياراتي"
        description="طلبات الزيارات التي قمتَ بإرسالها للإدارة وحالاتها."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الزيارات' },
        ]}
        actions={
          <Link href="/portal/visits/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              طلب زيارة
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الزيارات: {r.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/visits"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select
          name="requestStatus"
          inputSize="sm"
          defaultValue={sp.requestStatus ?? ''}
          className="w-48 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="NEW">جديد</option>
          <option value="UNDER_REVIEW">قيد المراجعة</option>
          <option value="CONVERTED">تم التحويل</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CANCELLED">ملغى</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {sp.requestStatus && (
            <Link href="/portal/visits">
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
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ المقترح</th>
                <th className="text-start font-semibold py-3 px-4">حالة الطلب</th>
                <th className="text-start font-semibold py-3 px-4">الموعد المجدول</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<CalendarClock />}
                      title="لا توجد زيارات بعد"
                      description="ابدأ بطلب أول زيارة لعميل."
                      action={
                        <Link href="/portal/visits/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            طلب زيارة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((v) => {
                const upcoming = v.appointments?.[0];
                return (
                  <tr
                    key={v.id}
                    className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 ps-5 pe-4">
                      <p className="font-medium text-slate-900">
                        {v.lead?.fullName ?? v.customerName ?? '—'}
                      </p>
                      <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1" dir="ltr">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {v.lead?.phone ?? v.customerPhone ?? '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {v.project ? tx(v.project.name) : '—'}
                    </td>
                    <td className="py-3 px-4 text-2xs font-mono text-slate-700" dir="ltr">
                      {v.unit?.code ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {formatDate(v.preferredDate)}
                    </td>
                    <td className="py-3 px-4">
                      {v.requestStatus ? (
                        <VisitRequestStatusBadge status={v.requestStatus} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {upcoming ? (
                        <div className="space-y-1">
                          <p className="text-slate-700">{formatDateTime(upcoming.scheduledAt)}</p>
                          <AppointmentStatusBadge status={upcoming.status} />
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/visits"
            params={{ requestStatus: sp.requestStatus }}
          />
        )}
      </Card>
    </div>
  );
}
