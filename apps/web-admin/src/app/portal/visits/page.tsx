import Link from 'next/link';
import {
  Plus,
  CalendarClock,
  Phone,
  Clock,
  XCircle,
  CalendarCheck2,
  AlertCircle,
  Building2,
  Home,
} from 'lucide-react';
import { CodeText } from '@/components/ui/code-text';
import { api, safe } from '@/lib/api';
import type { Paged, PortalVisitRequest } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
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
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

/** Time-aware urgency label for a scheduled appointment — runs server-side. */
function appointmentUrgency(
  iso: string | null | undefined,
): { label: string; className: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const tom = new Date(now);
  tom.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString())
    return { label: 'اليوم', className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (d.toDateString() === tom.toDateString())
    return { label: 'غداً', className: 'bg-blue-50 text-blue-700 border border-blue-100' };
  if (d < now)
    return { label: 'مضى', className: 'bg-slate-100 text-slate-500 border border-slate-200' };
  return null;
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

  const [r, rNew, rUnderReview, rConverted, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalVisitRequest>>(`/portal/visits?${qs.toString()}`)),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=NEW')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=UNDER_REVIEW')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=CONVERTED')),
    safe(api.get<Paged<PortalVisitRequest>>('/portal/visits?page=1&pageSize=1&requestStatus=REJECTED')),
  ]);

  const paged        = r.data;
  const rows         = paged?.data ?? [];
  // Pending = NEW (not seen by admin yet) + UNDER_REVIEW (admin is reviewing)
  const pendingCount   = (rNew.data?.meta.total ?? 0) + (rUnderReview.data?.meta.total ?? 0);
  const scheduledCount = rConverted.data?.meta.total ?? 0;
  const rejectedCount  = rRejected.data?.meta.total  ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="الزيارات"
        description="طلبات الزيارات لعملائك — تابع حالة كل طلب والموعد المجدول مع العميل."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الزيارات' },
        ]}
        actions={
          <Link href="/portal/visits/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              طلب زيارة جديدة
            </Button>
          </Link>
        }
      />

      {r.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل الزيارات: {r.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الطلبات"  value={paged?.meta.total ?? 0} icon={<CalendarClock />}  tone="brand"   />
        <PageKpiCard label="بانتظار الجدولة" value={pendingCount}           icon={<Clock />}           tone="warning" />
        <PageKpiCard label="موعد مجدول"      value={scheduledCount}         icon={<CalendarCheck2 />}  tone="success" />
        <PageKpiCard label="مرفوض / ملغى"    value={rejectedCount}          icon={<XCircle />}         tone="danger"  />
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
          className="w-52 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="NEW">جديد — لم يُراجع بعد</option>
          <option value="UNDER_REVIEW">قيد المراجعة</option>
          <option value="CONVERTED">تم الجدولة</option>
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
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>طلب زيارة</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">المشروع / الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">الموعد المجدول</th>
                <th className="text-start font-semibold py-3 px-4">حالة الطلب</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ المقترح</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon={<CalendarClock />}
                      title="لا توجد زيارات بعد"
                      description="ابدأ بطلب أول زيارة لعميل مهتم بأحد مشاريعك."
                      action={
                        <Link href="/portal/visits/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            طلب زيارة جديدة
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((v) => {
                const clientName  = v.lead?.fullName ?? v.customerName;
                const clientPhone = v.lead?.phone ?? v.customerPhone;
                const appt        = v.appointments?.[0];
                const urgency     = appointmentUrgency(appt?.scheduledAt);
                const isToday     = urgency?.label === 'اليوم';

                return (
                  <tr
                    key={v.id}
                    className={cn(
                      'border-t border-hairline align-top transition-colors',
                      isToday
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : 'hover:bg-surface-muted/40',
                    )}
                  >
                    {/* Client */}
                    <td className="py-3 ps-5 pe-4">
                      {clientName ? (
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              'h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0',
                              avatarColor(clientName),
                            )}
                          >
                            {initials(clientName)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{clientName}</p>
                            {clientPhone && (
                              <a
                                href={`tel:${clientPhone}`}
                                className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                                dir="ltr"
                              >
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {clientPhone}
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Project / Unit */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-px" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {v.project ? tx(v.project.name) : '—'}
                          </p>
                          {v.unit?.code && (
                            <p className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                              <Home className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                              <CodeText>{v.unit.code}</CodeText>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Scheduled appointment (high priority: is today's visit happening?) */}
                    <td className="py-3 px-4">
                      {appt ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {urgency && (
                              <span
                                className={cn(
                                  'text-2xs font-bold px-1.5 py-0.5 rounded-md',
                                  urgency.className,
                                )}
                              >
                                {urgency.label}
                              </span>
                            )}
                            <CodeText className="text-xs text-slate-800 font-semibold tabular-nums">
                              {formatDateTime(appt.scheduledAt)}
                            </CodeText>
                          </div>
                          <AppointmentStatusBadge status={appt.status} />
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          بانتظار الجدولة
                        </span>
                      )}
                    </td>

                    {/* Request status */}
                    <td className="py-3 px-4">
                      {v.requestStatus ? (
                        <VisitRequestStatusBadge status={v.requestStatus} />
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Preferred date (lower priority — admin already saw it) */}
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(v.preferredDate)}
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
