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
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

const CMD_LINK =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/[0.07] hover:text-white/95 transition-colors';
const CMD_ICON =
  'h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/[0.08] text-brand-300 shrink-0 [&_svg]:h-4 [&_svg]:w-4';

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
      ? (
          await safe(
            api.get<Paged<UserType>>('/users?role=SALES,SALES_MANAGER&active=true&pageSize=100'),
          )
        ).data?.data ?? []
      : [];
  const clientName =
    reservation.client?.fullName ?? reservation.lead?.fullName ?? '—';
  const clientPhone =
    reservation.client?.phone ?? reservation.lead?.phone ?? null;
  const clientEmail =
    reservation.client?.email ?? reservation.lead?.email ?? null;
  const project = reservation.unit?.building?.phase?.project;
  const activities = reservation.activities ?? [];
  const notes = reservation.reservationNotes ?? [];
  const bookingDeposits = reservation.deposits ?? [];

  const isExpired =
    reservation.status === 'PENDING' &&
    new Date(reservation.expiresAt) < new Date();

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={`حجز — ${reservation.reservationNumber ?? reservation.id.slice(0, 8)}`}
        description={`العميل: ${clientName}${reservation.unit ? ` · الوحدة: ${reservation.unit.code}` : ''}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الحجوزات', href: '/dashboard/reservations' },
          { label: reservation.reservationNumber ?? 'الحجز' },
        ]}
        meta={
          <div className="flex items-center gap-2 flex-wrap">
            <ReservationStatusBadge status={reservation.status} />
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-xs text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
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
            salesOptions={salesOptions.map((s) => ({
              id: s.id,
              fullName: s.fullName,
            }))}
            canManage={isAdmin}
          />
        }
      />

      <PremiumDetailLayout
        main={
          <>
            {/* Reservation details */}
            <PremiumSectionCard title="تفاصيل الحجز">
              <div className="grid grid-cols-2 gap-4 text-sm">
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
              </div>
            </PremiumSectionCard>

            {/* Booking amount */}
            <PremiumSectionCard title="مبلغ الحجز">
              <div className="space-y-4">
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
                      <ReservationBookingPaymentBadge
                        status={reservation.bookingPaymentStatus}
                      />
                    </dd>
                  </div>
                  {reservation.bookingPaidAt && (
                    <div>
                      <dt className="text-slate-500 mb-0.5">تاريخ دفع مبلغ الحجز</dt>
                      <dd className="font-medium">
                        {formatDateTime(reservation.bookingPaidAt)}
                      </dd>
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

                <div className="pt-3 border-t border-hairline">
                  <p className="text-xs font-semibold text-slate-700 mb-2">دفعة مبلغ الحجز</p>
                  {bookingDeposits.length === 0 ? (
                    <p className="text-xs text-slate-400">لم يتم تسجيل دفعة حجز بعد.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bookingDeposits.map((dep) => (
                        <li
                          key={dep.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-canvas/60 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold tabular-nums" dir="ltr">
                              {Number(dep.amount).toLocaleString('ar-SA')} ر.س
                            </p>
                            <p className="text-2xs text-slate-500 mt-0.5">
                              {formatDate(dep.paidAt)} ·{' '}
                              <span
                                className={
                                  dep.verified ? 'text-success-700' : 'text-amber-700'
                                }
                              >
                                {dep.verified ? 'متحقق' : 'غير متحقق'}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {dep.receiptUrl && (
                              <a
                                href={dep.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" /> إيصال
                              </a>
                            )}
                            <Link
                              href={`/dashboard/deposits/${dep.id}`}
                              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                            >
                              تفاصيل الدفعة
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {bookingDeposits.length > 1 && (
                    <p className="text-2xs text-amber-700 mt-2">
                      تنبيه: يوجد أكثر من دفعة حجز مسجّلة لهذا الحجز.
                    </p>
                  )}
                </div>

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
              </div>
            </PremiumSectionCard>

            {/* Selected duration snapshot (only when chosen at create time) */}
            {reservation.selectedDurationMonths != null && (
              <PremiumSectionCard title="خطة التقسيط المختارة">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
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
                          {Number(reservation.snapshotDownPaymentAmount).toLocaleString(
                            'ar-SA',
                          )}{' '}
                          ر.س
                        </dd>
                      </div>
                    )}
                    {reservation.snapshotRemainingAmount != null && (
                      <div>
                        <dt className="text-slate-500 mb-0.5">المبلغ المتبقي</dt>
                        <dd className="font-medium tabular-nums" dir="ltr">
                          {Number(reservation.snapshotRemainingAmount).toLocaleString(
                            'ar-SA',
                          )}{' '}
                          ر.س
                        </dd>
                      </div>
                    )}
                    {reservation.snapshotFinancedAmount != null && (
                      <div>
                        <dt className="text-slate-500 mb-0.5">المبلغ الممول</dt>
                        <dd className="font-medium tabular-nums" dir="ltr">
                          {Number(reservation.snapshotFinancedAmount).toLocaleString(
                            'ar-SA',
                          )}{' '}
                          ر.س
                        </dd>
                      </div>
                    )}
                    {reservation.snapshotMonthlyInstallment != null && (
                      <div>
                        <dt className="text-slate-500 mb-0.5">القسط الشهري</dt>
                        <dd className="font-bold tabular-nums text-brand-700" dir="ltr">
                          {Number(reservation.snapshotMonthlyInstallment).toLocaleString(
                            'ar-SA',
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                          )}{' '}
                          ر.س
                        </dd>
                      </div>
                    )}
                    {reservation.snapshotTotalPayable != null && (
                      <div className="col-span-2 border-t border-hairline pt-3 mt-1">
                        <dt className="text-slate-500 mb-0.5">إجمالي السداد</dt>
                        <dd className="font-bold tabular-nums text-slate-900 text-base" dir="ltr">
                          {Number(reservation.snapshotTotalPayable).toLocaleString('ar-SA')}{' '}
                          ر.س
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </PremiumSectionCard>
            )}

            {/* Internal notes */}
            <PremiumSectionCard title="الملاحظات الداخلية">
              <div className="space-y-4">
                <AddNoteForm reservationId={reservation.id} />
                {notes.length > 0 && (
                  <ul className="space-y-3 mt-2">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="relative rounded-2xl bg-canvas/60 border border-hairline px-4 py-3"
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
              </div>
            </PremiumSectionCard>

            {/* Activity timeline */}
            <PremiumSectionCard title="سجل النشاط">
              <ReservationTimelineCard activities={activities} />
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Quick navigation */}
            <PremiumCommandPanel title="إجراءات سريعة">
              <div className="flex flex-col gap-0.5">
                {reservation.unit && (
                  <Link
                    href={`/dashboard/units/${reservation.unitId}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Home /></span>
                    <span>عرض الوحدة</span>
                  </Link>
                )}
                {reservation.lead && (
                  <Link
                    href={`/dashboard/leads/${reservation.leadId}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><User /></span>
                    <span>عرض العميل المحتمل</span>
                  </Link>
                )}
                {reservation.client && (
                  <Link
                    href={`/dashboard/clients/${reservation.clientId}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><User /></span>
                    <span>عرض ملف العميل</span>
                  </Link>
                )}
                {project && (
                  <Link
                    href={`/dashboard/projects/${project.id}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Building2 /></span>
                    <span>عرض المشروع</span>
                  </Link>
                )}
                {reservation.status === 'CONVERTED' && reservation.contract && (
                  <Link
                    href={`/dashboard/contracts/${reservation.contract.id}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><FileText /></span>
                    <span>عرض العقد</span>
                  </Link>
                )}
              </div>
            </PremiumCommandPanel>

            {/* Linked contract — shown when CONVERTED */}
            {reservation.status === 'CONVERTED' && reservation.contract && (
              <PremiumSectionCard title="العقد المرتبط" icon={<FileText />}>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-500 text-xs">تم تحويل هذا الحجز إلى عقد</p>
                  <Link
                    href={`/dashboard/contracts/${reservation.contract.id}` as never}
                    className="flex items-center gap-2 font-semibold text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {reservation.contract.contractNumber ??
                      reservation.contract.id.slice(0, 8)}
                  </Link>
                  {reservation.convertedAt && (
                    <p className="text-xs text-slate-400">
                      في {formatDateTime(reservation.convertedAt)}
                    </p>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            {/* Convert to contract — ADMIN on APPROVED only */}
            {isAdmin && reservation.status === 'APPROVED' && (
              <PremiumSectionCard title="تحويل إلى عقد" icon={<FileText />}>
                <ConvertReservationForm
                  reservation={{
                    id: reservation.id,
                    status: reservation.status,
                    bookingAmount: reservation.bookingAmount,
                    bookingPaymentStatus: reservation.bookingPaymentStatus,
                    installmentPlanTemplateId:
                      reservation.installmentPlanTemplateId ?? null,
                    selectedDurationMonths:
                      reservation.selectedDurationMonths ?? null,
                    selectedIncreasePercentage:
                      reservation.selectedIncreasePercentage ?? null,
                    snapshotDownPaymentAmount:
                      reservation.snapshotDownPaymentAmount ?? null,
                    snapshotMonthlyInstallment:
                      reservation.snapshotMonthlyInstallment ?? null,
                    snapshotTotalPayable: reservation.snapshotTotalPayable ?? null,
                    clientName,
                    unitCode: reservation.unit?.code ?? '—',
                  }}
                />
              </PremiumSectionCard>
            )}

            {/* Client / Lead */}
            <PremiumSectionCard title="معلومات العميل" icon={<User />}>
              <div className="space-y-3 text-sm">
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
              </div>
            </PremiumSectionCard>

            {/* Unit */}
            {reservation.unit && (
              <PremiumSectionCard title="معلومات الوحدة" icon={<Home />}>
                <div className="space-y-2 text-sm">
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
                      <p dir="ltr">
                        {Number(reservation.unit.price).toLocaleString('ar-SA')} ر.س
                      </p>
                    </div>
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Project */}
            {project && (
              <PremiumSectionCard title="المشروع" icon={<Building2 />}>
                <div className="space-y-1.5 text-sm">
                  <Link
                    href={`/dashboard/projects/${project.id}` as never}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {tx(project.name)}
                  </Link>
                  <p className="text-slate-500 text-xs">{project.city}</p>
                </div>
              </PremiumSectionCard>
            )}

            {/* Sales person */}
            {reservation.sales && (
              <PremiumSectionCard title="المندوب المسؤول" icon={<User />}>
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">{reservation.sales.fullName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    أنشأ الحجز في {formatDate(reservation.createdAt)}
                  </p>
                </div>
              </PremiumSectionCard>
            )}
          </>
        }
      />
    </div>
  );
}
