import Link from 'next/link';
import {
  Phone,
  Mail,
  Building2,
  User,
  ExternalLink,
  AlertCircle,
  Clock,
  Home,
  FileText,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Reservation, User as UserType } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ReservationStatusBadge,
  ReservationBookingPaymentBadge,
  UnitStatusBadge,
} from '@/components/badges';
import { ReservationTimelineCard } from '../_components/reservation-timeline';
import { ReservationDetailActions } from './_components/detail-actions';
import { AddNoteForm } from './_components/add-note-form';
import { BookingPaymentActions } from './_components/booking-payment-actions';
import { ConvertReservationForm } from './_components/convert-reservation-form';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const res = await safe(api.get<Reservation>(`/reservations/${id}`));

  if (res.error || !res.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>تعذر تحميل بيانات الحجز: {res.error ?? 'غير موجود'}</p>
      </div>
    );
  }

  const reservation = res.data;
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const salesOptions =
    reservation.status === 'PENDING'
      ? (await safe(api.get<Paged<UserType>>('/users?role=SALES&active=true&pageSize=100'))).data
          ?.data ?? []
      : [];
  const clientName = reservation.client?.fullName ?? reservation.lead?.fullName ?? '—';
  const clientPhone = reservation.client?.phone ?? reservation.lead?.phone ?? null;
  const clientEmail = reservation.client?.email ?? reservation.lead?.email ?? null;
  const project = reservation.unit?.building?.phase?.project;
  const activities = reservation.activities ?? [];
  const notes = reservation.reservationNotes ?? [];

  const isExpired =
    reservation.status === 'PENDING' && new Date(reservation.expiresAt) < new Date();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`حجز — ${reservation.reservationNumber ?? reservation.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الحجوزات', href: '/dashboard/reservations' },
          { label: reservation.reservationNumber ?? 'الحجز' },
        ]}
        meta={
          <div className="flex items-center gap-2 flex-wrap">
            <ReservationStatusBadge status={reservation.status} />
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-xs text-danger-600">
                <Clock className="h-3.5 w-3.5" />
                انتهت الصلاحية
              </span>
            )}
          </div>
        }
        actions={
          <ReservationDetailActions
            reservationId={reservation.id}
            status={reservation.status}
            currentSalesId={reservation.salesId}
            currentNotes={reservation.notes}
            salesOptions={salesOptions.map((s) => ({ id: s.id, fullName: s.fullName }))}
          />
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: main content (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Reservation details card */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الحجز</CardTitle>
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">رقم الحجز</p>
                <p className="font-mono font-medium">
                  {reservation.reservationNumber ?? reservation.id.slice(0, 8)}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">الحالة</p>
                <ReservationStatusBadge status={reservation.status} />
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">تاريخ الإنشاء</p>
                <p className="font-medium">{formatDateTime(reservation.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">تاريخ الانتهاء</p>
                <p className={`font-medium ${isExpired ? 'text-danger-600' : ''}`}>
                  {formatDateTime(reservation.expiresAt)}
                </p>
              </div>
              {reservation.approvedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ الموافقة</p>
                  <p className="font-medium text-success-700">
                    {formatDateTime(reservation.approvedAt)}
                  </p>
                </div>
              )}
              {reservation.rejectedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ الرفض</p>
                  <p className="font-medium text-danger-600">
                    {formatDateTime(reservation.rejectedAt)}
                  </p>
                </div>
              )}
              {reservation.cancelledAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ الإلغاء</p>
                  <p className="font-medium text-danger-600">
                    {formatDateTime(reservation.cancelledAt)}
                  </p>
                </div>
              )}
              {reservation.convertedAt && (
                <div>
                  <p className="text-slate-500 mb-0.5">تاريخ التحويل إلى عقد</p>
                  <p className="font-medium text-success-700">
                    {formatDateTime(reservation.convertedAt)}
                  </p>
                </div>
              )}
              {reservation.reason && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">السبب</p>
                  <p className="text-slate-700">{reservation.reason}</p>
                </div>
              )}
              {reservation.notes && (
                <div className="col-span-2">
                  <p className="text-slate-500 mb-0.5">ملاحظات الحجز</p>
                  <p className="text-slate-700">{reservation.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Booking amount card */}
          <Card>
            <CardHeader>
              <CardTitle>مبلغ الحجز</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500 mb-0.5">مبلغ الحجز المطلوب</dt>
                  <dd className="font-bold text-slate-900 text-base" dir="ltr">
                    {Number(reservation.bookingAmount).toLocaleString('ar-SA')} ر.س
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 mb-0.5">حالة دفع مبلغ الحجز</dt>
                  <dd>
                    <ReservationBookingPaymentBadge status={reservation.bookingPaymentStatus} />
                  </dd>
                </div>
                {reservation.bookingPaidAt && (
                  <div>
                    <dt className="text-slate-500 mb-0.5">تاريخ دفع مبلغ الحجز</dt>
                    <dd className="font-medium">{formatDateTime(reservation.bookingPaidAt)}</dd>
                  </div>
                )}
                {reservation.installmentPlanTemplate && (
                  <div>
                    <dt className="text-slate-500 mb-0.5">خطة التقسيط المرتبطة</dt>
                    <dd className="font-medium">
                      <Link
                        href={
                          `/dashboard/installments/${reservation.installmentPlanTemplate.id}` as never
                        }
                        className="text-brand-700 hover:underline"
                      >
                        {reservation.installmentPlanTemplate.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {reservation.bookingNotes && (
                  <div className="col-span-2">
                    <dt className="text-slate-500 mb-0.5">ملاحظات مبلغ الحجز</dt>
                    <dd className="text-slate-700 whitespace-pre-wrap">
                      {reservation.bookingNotes}
                    </dd>
                  </div>
                )}
              </dl>
              {isAdmin && (
                <div className="pt-2 border-t border-hairline">
                  <BookingPaymentActions
                    reservationId={reservation.id}
                    bookingPaymentStatus={reservation.bookingPaymentStatus}
                    reservationStatus={reservation.status}
                    bookingAmount={Number(reservation.bookingAmount)}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          {/* Selected duration snapshot card (only when a duration was chosen at create time) */}
          {reservation.selectedDurationMonths != null && (
            <Card>
              <CardHeader>
                <CardTitle>خطة التقسيط المختارة</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-xs text-slate-500 mb-3">
                  هذه القيم تم تجميدها عند إنشاء الحجز ولا تتأثر بأي تعديل لاحق على الخطة.
                </p>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500 mb-0.5">مدة التقسيط المختارة</dt>
                    <dd className="font-medium tabular-nums">
                      {reservation.selectedDurationMonths} شهر
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 mb-0.5">نسبة الزيادة</dt>
                    <dd className="font-medium tabular-nums">
                      {Number(reservation.selectedIncreasePercentage ?? 0)}%
                    </dd>
                  </div>
                  {reservation.snapshotDownPaymentAmount != null && (
                    <div>
                      <dt className="text-slate-500 mb-0.5">الدفعة الأولى</dt>
                      <dd className="font-medium tabular-nums" dir="ltr">
                        {Number(reservation.snapshotDownPaymentAmount).toLocaleString('ar-SA')} ر.س
                      </dd>
                    </div>
                  )}
                  {reservation.snapshotRemainingAmount != null && (
                    <div>
                      <dt className="text-slate-500 mb-0.5">المبلغ المتبقي</dt>
                      <dd className="font-medium tabular-nums" dir="ltr">
                        {Number(reservation.snapshotRemainingAmount).toLocaleString('ar-SA')} ر.س
                      </dd>
                    </div>
                  )}
                  {reservation.snapshotFinancedAmount != null && (
                    <div>
                      <dt className="text-slate-500 mb-0.5">المبلغ الممول</dt>
                      <dd className="font-medium tabular-nums" dir="ltr">
                        {Number(reservation.snapshotFinancedAmount).toLocaleString('ar-SA')} ر.س
                      </dd>
                    </div>
                  )}
                  {reservation.snapshotMonthlyInstallment != null && (
                    <div>
                      <dt className="text-slate-500 mb-0.5">القسط الشهري</dt>
                      <dd className="font-bold tabular-nums text-brand-700" dir="ltr">
                        {Number(reservation.snapshotMonthlyInstallment).toLocaleString('ar-SA', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ر.س
                      </dd>
                    </div>
                  )}
                  {reservation.snapshotTotalPayable != null && (
                    <div className="col-span-2 border-t border-hairline pt-3 mt-1">
                      <dt className="text-slate-500 mb-0.5">إجمالي السداد</dt>
                      <dd className="font-bold tabular-nums text-slate-900 text-base" dir="ltr">
                        {Number(reservation.snapshotTotalPayable).toLocaleString('ar-SA')} ر.س
                      </dd>
                    </div>
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          {/* Internal notes card */}
          <Card>
            <CardHeader>
              <CardTitle>الملاحظات الداخلية</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <AddNoteForm reservationId={reservation.id} />
              {notes.length > 0 && (
                <ul className="space-y-3 mt-2">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="relative rounded-2xl bg-surface-muted/50 border border-hairline px-4 py-3"
                    >
                      <span className="absolute end-0 top-2 bottom-2 w-[3px] rounded-s-full bg-brand-500" />
                      <p className="text-sm text-slate-800">{note.body}</p>
                      <p className="text-2xs text-slate-400 mt-1">
                        {note.author?.fullName ?? 'النظام'} ·{' '}
                        {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Activity timeline card */}
          <Card>
            <CardBody>
              <ReservationTimelineCard activities={activities} />
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-4">
          {/* Linked contract card — shown when CONVERTED */}
          {reservation.status === 'CONVERTED' && reservation.contract && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-success-600" />
                  العقد المرتبط
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <p className="text-slate-500 text-xs">تم تحويل هذا الحجز إلى عقد</p>
                <Link
                  href={`/dashboard/contracts/${reservation.contract.id}` as never}
                  className="flex items-center gap-2 font-semibold text-brand-700 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {reservation.contract.contractNumber ?? reservation.contract.id.slice(0, 8)}
                </Link>
                {reservation.convertedAt && (
                  <p className="text-xs text-slate-400">
                    في {formatDateTime(reservation.convertedAt)}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Convert to contract card — shown to ADMIN on APPROVED reservations only */}
          {isAdmin && reservation.status === 'APPROVED' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-600" />
                  تحويل إلى عقد
                </CardTitle>
              </CardHeader>
              <CardBody>
                <ConvertReservationForm
                  reservation={{
                    id: reservation.id,
                    status: reservation.status,
                    bookingAmount: reservation.bookingAmount,
                    bookingPaymentStatus: reservation.bookingPaymentStatus,
                    installmentPlanTemplateId: reservation.installmentPlanTemplateId ?? null,
                    selectedDurationMonths: reservation.selectedDurationMonths ?? null,
                    selectedIncreasePercentage: reservation.selectedIncreasePercentage ?? null,
                    snapshotDownPaymentAmount: reservation.snapshotDownPaymentAmount ?? null,
                    snapshotMonthlyInstallment: reservation.snapshotMonthlyInstallment ?? null,
                    snapshotTotalPayable: reservation.snapshotTotalPayable ?? null,
                    clientName,
                    unitCode: reservation.unit?.code ?? '—',
                  }}
                />
              </CardBody>
            </Card>
          )}

          {/* Client / Lead card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" />
                معلومات العميل
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <p className="font-semibold text-slate-900 text-base">{clientName}</p>
              {clientPhone && (
                <a
                  href={`tel:${clientPhone}`}
                  className="flex items-center gap-2 text-slate-600 hover:text-brand-700"
                >
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{clientPhone}</span>
                </a>
              )}
              {clientEmail && (
                <a
                  href={`mailto:${clientEmail}`}
                  className="flex items-center gap-2 text-slate-600 hover:text-brand-700"
                >
                  <Mail className="h-4 w-4" />
                  <span dir="ltr">{clientEmail}</span>
                </a>
              )}
              {reservation.lead && (
                <Link
                  href={`/dashboard/leads/${reservation.leadId}` as never}
                  className="flex items-center gap-2 text-brand-700 hover:underline text-xs mt-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  عرض العميل المحتمل
                </Link>
              )}
              {reservation.client && (
                <Link
                  href={`/dashboard/clients/${reservation.clientId}` as never}
                  className="flex items-center gap-2 text-brand-700 hover:underline text-xs mt-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  عرض ملف العميل
                </Link>
              )}
            </CardBody>
          </Card>

          {/* Unit card */}
          {reservation.unit && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-brand-600" />
                  معلومات الوحدة
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/units/${reservation.unitId}` as never}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    وحدة: {reservation.unit.code}
                  </Link>
                  <UnitStatusBadge status={reservation.unit.status} />
                </div>
                <p className="text-slate-600">{reservation.unit.type}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1">
                  <div>
                    <p className="font-medium text-slate-700">المساحة</p>
                    <p>{reservation.unit.area} م²</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">الطابق</p>
                    <p>{reservation.unit.floor}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">غرف النوم</p>
                    <p>{reservation.unit.bedrooms}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">السعر</p>
                    <p dir="ltr">{Number(reservation.unit.price).toLocaleString('ar-SA')} ر.س</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Project card */}
          {project && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand-600" />
                  المشروع
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <Link
                  href={`/dashboard/projects/${project.id}` as never}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {tx(project.name)}
                </Link>
                <p className="text-slate-500 text-xs">{project.city}</p>
              </CardBody>
            </Card>
          )}

          {/* Sales person card */}
          {reservation.sales && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-brand-600" />
                  المندوب المسؤول
                </CardTitle>
              </CardHeader>
              <CardBody className="text-sm">
                <p className="font-semibold text-slate-900">{reservation.sales.fullName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  أنشأ الحجز في {formatDate(reservation.createdAt)}
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
