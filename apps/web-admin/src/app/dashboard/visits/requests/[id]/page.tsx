import Link from 'next/link';
import { Phone, Mail, Building2, User, ExternalLink, AlertCircle } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, VisitRequest, VisitActivity, User as UserType } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/table';
import { VisitRequestStatusBadge, AppointmentStatusBadge } from '@/components/badges';
import { VisitTimelineCard } from '../../_components/visit-timeline';
import { RequestDetailActions } from './_components/request-detail-actions';

export const dynamic = 'force-dynamic';

interface VisitRequestDetail extends VisitRequest {
  visitActivities?: VisitActivity[];
}

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'الموقع الإلكتروني',
  MOBILE_APP: 'التطبيق',
  SALES: 'فريق المبيعات',
  PHONE: 'هاتف',
  WHATSAPP: 'واتساب',
  OTHER: 'أخرى',
};

export default async function VisitRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [reqRes, salesRes] = await Promise.all([
    safe(api.get<VisitRequestDetail>(`/visits/requests/${id}`)),
    safe(api.get<Paged<UserType>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
  ]);

  if (reqRes.error || !reqRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>تعذر تحميل بيانات الطلب: {reqRes.error ?? 'غير موجود'}</p>
      </div>
    );
  }

  const req = reqRes.data;
  const salesOptions = salesRes.data?.data ?? [];
  const customerName = req.customerName ?? req.user?.fullName ?? req.lead?.fullName ?? '—';
  const customerPhone = req.customerPhone ?? req.user?.phone ?? req.lead?.phone ?? null;
  const customerEmail = req.customerEmail ?? req.user?.email ?? req.lead?.email ?? null;
  const activities: VisitActivity[] = req.visitActivities ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`طلب زيارة — ${req.requestNumber ?? req.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الزيارات', href: '/dashboard/visits?tab=requests' },
          { label: req.requestNumber ?? 'الطلب' },
        ]}
        meta={
          req.requestStatus ? <VisitRequestStatusBadge status={req.requestStatus} /> : undefined
        }
        actions={
          <RequestDetailActions request={req} salesOptions={salesOptions} />
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: main content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Request info card */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الطلب</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">التاريخ المفضل</p>
                <p className="font-medium">{formatDate(req.preferredDate)}</p>
              </div>
              {req.preferredTime && (
                <div>
                  <p className="text-slate-500 mb-0.5">الوقت المفضل</p>
                  <p className="font-medium">{req.preferredTime}</p>
                </div>
              )}
              {req.source && (
                <div>
                  <p className="text-slate-500 mb-0.5">مصدر الطلب</p>
                  <p className="font-medium">{SOURCE_LABELS[req.source] ?? req.source}</p>
                </div>
              )}
              {req.preferredContactMethod && (
                <div>
                  <p className="text-slate-500 mb-0.5">طريقة التواصل المفضلة</p>
                  <p className="font-medium">{req.preferredContactMethod}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 mb-0.5">تاريخ الإنشاء</p>
                <p className="font-medium">{formatDateTime(req.createdAt)}</p>
              </div>
              {req.convertedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ التحويل</p>
                  <p className="font-medium">{formatDateTime(req.convertedAt)}</p>
                </div>
              )}
              {/* Customer's submitted message. Pre-this-fix rows have only
                  `notes` populated; new rows have `requestNotes` too. Fall
                  back to either so legacy records render correctly. */}
              {(req.requestNotes ?? req.notes) && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">ملاحظات العميل</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{req.requestNotes ?? req.notes}</p>
                </div>
              )}
              {req.adminNotes && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">ملاحظات الإدارة</p>
                  <p className="text-slate-700">{req.adminNotes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Linked appointments */}
          {req.appointments && req.appointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>الزيارات المرتبطة</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <DataTable
                  rowKey={(a) => a.id}
                  rows={req.appointments}
                  emptyMessage="لا توجد زيارات"
                  columns={[
                    {
                      key: 'number',
                      header: 'رقم الزيارة',
                      cell: (a) => (
                        <Link
                          href={`/dashboard/visits/appointments/${a.id}` as never}
                          className="font-mono text-xs text-brand-700 hover:underline"
                        >
                          {a.visitNumber}
                        </Link>
                      ),
                    },
                    { key: 'date', header: 'الموعد', cell: (a) => formatDateTime(a.scheduledAt) },
                    { key: 'sales', header: 'المندوب', cell: (a) => a.assignedSales?.fullName ?? '—' },
                    { key: 'status', header: 'الحالة', cell: (a) => <AppointmentStatusBadge status={a.status} /> },
                  ]}
                />
              </CardBody>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardBody>
              <VisitTimelineCard activities={activities} />
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Customer card */}
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

          {/* Lead/Client link */}
          {(req.lead || req.user) && (
            <Card>
              <CardHeader>
                <CardTitle>الربط بـ CRM</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                {req.lead && (
                  <Link href={`/dashboard/leads/${req.leadId}` as never} className="flex items-center gap-2 text-brand-700 hover:underline">
                    <ExternalLink className="h-4 w-4" />
                    عميل محتمل: {req.lead.fullName}
                  </Link>
                )}
                {req.user && !req.lead && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {req.user.fullName}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Project/Unit card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-600" />
                المشروع والوحدة
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Link
                href={`/dashboard/projects/${req.projectId}` as never}
                className="font-medium text-brand-700 hover:underline"
              >
                {tx(req.project?.name)}
              </Link>
              {req.unit && (
                <p className="text-slate-600">
                  وحدة: {req.unit.code} — {req.unit.type}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
