import Link from 'next/link';
import { Phone, Mail, Building2, User, ExternalLink, AlertCircle, CalendarClock } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, VisitAppointment, User as UserType, VisitActivity } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { AppointmentStatusBadge } from '@/components/badges';
import { VisitTimelineCard } from '../../_components/visit-timeline';
import { AppointmentDetailActions } from './_components/appointment-detail-actions';

export const dynamic = 'force-dynamic';

interface AppointmentDetail extends VisitAppointment {
  visitActivities?: VisitActivity[];
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [apptRes, salesRes] = await Promise.all([
    safe(api.get<AppointmentDetail>(`/visits/appointments/${id}`)),
    safe(api.get<Paged<UserType>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
  ]);

  if (apptRes.error || !apptRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>تعذر تحميل بيانات الزيارة: {apptRes.error ?? 'غير موجود'}</p>
      </div>
    );
  }

  const appt = apptRes.data;
  const salesOptions = salesRes.data?.data ?? [];
  const activities = appt.visitActivities ?? [];
  const customerName = appt.client?.fullName ?? appt.lead?.fullName ?? appt.visitRequest?.customerName ?? '—';
  const customerPhone = appt.client?.phone ?? appt.lead?.phone ?? appt.visitRequest?.customerPhone ?? null;
  const customerEmail = appt.client?.email ?? null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`زيارة — ${appt.visitNumber}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الزيارات', href: '/dashboard/visits?tab=appointments' },
          { label: appt.visitNumber },
        ]}
        meta={<AppointmentStatusBadge status={appt.status} />}
        actions={
          <AppointmentDetailActions appointment={appt} salesOptions={salesOptions} />
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Appointment info */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الزيارة</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">الموعد</p>
                <p className="font-medium">{formatDateTime(appt.scheduledAt)}</p>
              </div>
              {appt.durationMinutes && (
                <div>
                  <p className="text-slate-500 mb-0.5">المدة</p>
                  <p className="font-medium">{appt.durationMinutes} دقيقة</p>
                </div>
              )}
              {appt.location && (
                <div>
                  <p className="text-slate-500 mb-0.5">الموقع</p>
                  <p className="font-medium">{appt.location}</p>
                </div>
              )}
              {appt.meetingPoint && (
                <div>
                  <p className="text-slate-500 mb-0.5">نقطة الالتقاء</p>
                  <p className="font-medium">{appt.meetingPoint}</p>
                </div>
              )}
              {appt.confirmedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ التأكيد</p>
                  <p className="font-medium">{formatDateTime(appt.confirmedAt)}</p>
                </div>
              )}
              {appt.completedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ الاكتمال</p>
                  <p className="font-medium">{formatDateTime(appt.completedAt)}</p>
                </div>
              )}
              {appt.salesNotes && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">ملاحظات المندوب</p>
                  <p className="text-slate-700">{appt.salesNotes}</p>
                </div>
              )}
              {appt.resultNotes && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">نتيجة الزيارة</p>
                  <p className="text-slate-700">{appt.resultNotes}</p>
                </div>
              )}
              {appt.cancellationReason && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">سبب الإلغاء</p>
                  <p className="text-slate-700">{appt.cancellationReason}</p>
                </div>
              )}
              {appt.noShowReason && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">سبب الغياب</p>
                  <p className="text-slate-700">{appt.noShowReason}</p>
                </div>
              )}
              {appt.customerFeedback && (
                <div className="col-span-2">
                  {/* When the appointment is awaiting an admin reschedule the
                      customer's reason was mirrored into customerFeedback.
                      Relabel accordingly so admins know what they're reading. */}
                  <p className="text-slate-500 mb-0.5">
                    {appt.status === 'PENDING_RESCHEDULE'
                      ? 'سبب طلب العميل لإعادة الجدولة'
                      : 'تقييم العميل'}
                  </p>
                  <p className="text-slate-700 whitespace-pre-wrap">{appt.customerFeedback}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardBody>
              <VisitTimelineCard activities={activities} />
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" />
                معلومات العميل
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <p className="font-semibold text-slate-900 text-base">{customerName}</p>
              {customerPhone && (
                <a href={`tel:${customerPhone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{customerPhone}</span>
                </a>
              )}
              {customerEmail && (
                <a href={`mailto:${customerEmail}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                  <Mail className="h-4 w-4" />
                  <span dir="ltr">{customerEmail}</span>
                </a>
              )}
            </CardBody>
          </Card>

          {/* Linked request */}
          {appt.visitRequestId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-brand-600" />
                  الطلب الأصلي
                </CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                <Link
                  href={`/dashboard/visits/requests/${appt.visitRequestId}` as never}
                  className="flex items-center gap-2 text-brand-700 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {appt.visitRequest?.requestNumber ?? appt.visitRequestId.slice(0, 8)}
                </Link>
              </CardBody>
            </Card>
          )}

          {/* Lead link */}
          {appt.leadId && appt.lead && (
            <Card>
              <CardHeader>
                <CardTitle>العميل المحتمل</CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                <Link
                  href={`/dashboard/leads/${appt.leadId}` as never}
                  className="flex items-center gap-2 text-brand-700 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {appt.lead.fullName}
                </Link>
              </CardBody>
            </Card>
          )}

          {/* Project/Unit */}
          {appt.projectId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand-600" />
                  المشروع والوحدة
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <Link
                  href={`/dashboard/projects/${appt.projectId}` as never}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {tx(appt.project?.name)}
                </Link>
                {appt.unit && (
                  <p className="text-slate-600">وحدة: {appt.unit.code} — {appt.unit.type}</p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Assigned Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" />
                المندوب المسؤول
              </CardTitle>
            </CardHeader>
            <CardBody className="text-sm">
              {appt.assignedSales ? (
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{appt.assignedSales.fullName}</p>
                  {appt.assignedSales.phone && (
                    <a href={`tel:${appt.assignedSales.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700">
                      <Phone className="h-3.5 w-3.5" />
                      <span dir="ltr">{appt.assignedSales.phone}</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-slate-400">غير محدد</p>
              )}
            </CardBody>
          </Card>

          {appt.createdBy && (
            <Card>
              <CardHeader>
                <CardTitle>أُنشئ بواسطة</CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                <p>{appt.createdBy.fullName}</p>
                <p className="text-slate-400 text-xs mt-0.5">{formatDate(appt.createdAt)}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
