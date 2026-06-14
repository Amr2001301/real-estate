import Link from 'next/link';
import {
  Plus,
  CalendarClock,
  Phone,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarCheck2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalVisitRequest } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  requestStatus?: string;
}

const PAGE_SIZE = 20;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default async function PortalVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.requestStatus) qs.set('requestStatus', sp.requestStatus);

  const [r, rNew, rConverted, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalVisitRequest>>(`/portal/visits?${qs.toString()}`)),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=NEW')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=CONVERTED')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=REJECTED')),
  ]);

  const paged          = r.data;
  const rows           = paged?.data ?? [];
  const newCount       = rNew.data?.meta.total       ?? 0;
  const convertedCount = rConverted.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total  ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="زياراتي"
        description="طلبات الزيارات التي أرسلتها للإدارة — تتبّع حالة الطلب والموعد المجدول."
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

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الطلبات" value={paged?.meta.total ?? 0} icon={<CalendarClock />}   tone="brand"   />
        <PageKpiCard label="جديد / قيد المراجعة" value={newCount}         icon={<Clock />}             tone="warning" />
        <PageKpiCard label="تم التحويل"     value={convertedCount}         icon={<CalendarCheck2 />}   tone="success" />
        <PageKpiCard label="مرفوض / ملغى"   value={rejectedCount}          icon={<XCircle />}          tone="danger"  />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
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
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {sp.requestStatus && (
            <Link href="/portal/visits">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>طلب زيارة</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">المشروع / الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ المقترح</th>
                <th className="text-start font-semibold py-3 px-4">حالة الطلب</th>
                <th className="text-start font-semibold py-3 px-4">الموعد المجدول</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon={<CalendarClock />}
                      title="لا توجد زيارات بعد"
                      description="ابدأ بطلب أول زيارة لعميل مهتم."
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
                const clientName = v.lead?.fullName ?? v.customerName;
                const clientPhone = v.lead?.phone ?? v.customerPhone;
                const upcoming = v.appointments?.[0];
                return (
                  <tr
                    key={v.id}
                    className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors"
                  >
                    {/* Client */}
                    <td className="py-3 ps-5 pe-4">
                      {clientName ? (
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs shrink-0">
                            {initials(clientName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-xs">{clientName}</p>
                            {clientPhone && (
                              <p className="text-2xs text-slate-400 mt-0.5 inline-flex items-center gap-1" dir="ltr">
                                <Phone className="h-3 w-3 text-slate-300" />
                                {clientPhone}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Project / Unit */}
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-700">
                        {v.project ? tx(v.project.name) : '—'}
                      </p>
                      {v.unit?.code && (
                        <p className="text-2xs font-mono text-slate-400 mt-0.5" dir="ltr">
                          {v.unit.code}
                        </p>
                      )}
                    </td>

                    {/* Preferred date */}
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(v.preferredDate)}
                    </td>

                    {/* Request status */}
                    <td className="py-3 px-4">
                      {v.requestStatus ? (
                        <VisitRequestStatusBadge status={v.requestStatus} />
                      ) : '—'}
                    </td>

                    {/* Scheduled appointment */}
                    <td className="py-3 px-4">
                      {upcoming ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-700 font-medium">
                            {formatDateTime(upcoming.scheduledAt)}
                          </p>
                          <AppointmentStatusBadge status={upcoming.status} />
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">لم يُجدَّل بعد</span>
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
