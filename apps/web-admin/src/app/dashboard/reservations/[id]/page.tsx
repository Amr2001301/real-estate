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
  Banknote,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged, Reservation, User as UserType } from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  ReservationStatusBadge,
  ReservationBookingPaymentBadge,
  UnitStatusBadge,
} from '@/components/badges';
import { ReservationTimeline } from '../_components/reservation-timeline';
import { ReservationDetailActions } from './_components/detail-actions';
import { AddNoteForm } from './_components/add-note-form';
import { BookingPaymentActions } from './_components/booking-payment-actions';
import { ConvertReservationForm } from './_components/convert-reservation-form';
import { PrintButton } from '@/components/print/PrintButton';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

const CMD_LINK =
  'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.reservationDetailPage;

  const res = await safe(api.get<Reservation>(`/reservations/${id}`));

  if (res.error || !res.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{m.errorLoad} {res.error ?? m.errorNotFound}</p>
      </div>
    );
  }

  const reservation = res.data;
  const [session, currency] = await Promise.all([getSession(), getReportsCurrency()]);
  const symbol = currencySymbol(currency);
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
        title={`${m.titlePrefix}${reservation.reservationNumber ?? reservation.id.slice(0, 8)}`}
        description={`${m.clientPrefix} ${clientName}${reservation.unit ? ` · ${m.unitPrefix} ${reservation.unit.code}` : ''}`}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbReservations, href: '/dashboard/reservations' },
          { label: reservation.reservationNumber ?? m.breadcrumbReservationFallback },
        ]}
        meta={
          <div className="flex items-center gap-2 flex-wrap">
            <ReservationStatusBadge status={reservation.status} />
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-xs text-danger-600 bg-danger-50 px-2 py-0.5 rounded-full">
                <Clock className="h-3.5 w-3.5" />
                {m.expiredBadge}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <PrintButton path="reservations" id={reservation.id} />
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
              locale={locale}
            />
          </div>
        }
      />

      <PremiumDetailLayout
        main={
          <>
            {/* Reservation details */}
            <PremiumSectionCard title={m.sectionReservationDetails}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Field label={m.fieldReservationNumber}>
                  <span className="font-mono text-[15px] font-bold text-slate-900">
                    {reservation.reservationNumber ?? reservation.id.slice(0, 8)}
                  </span>
                </Field>
                <Field label={m.fieldStatus}>
                  <ReservationStatusBadge status={reservation.status} />
                </Field>
                <Field label={m.fieldCreatedAt}>
                  <span className="text-[13px] font-semibold text-slate-800">
                    {formatDateTime(reservation.createdAt)}
                  </span>
                </Field>
                <Field label={m.fieldExpiresAt}>
                  <span className={cn('text-[13px] font-semibold', isExpired ? 'text-danger-600' : 'text-slate-800')}>
                    {formatDateTime(reservation.expiresAt)}
                  </span>
                </Field>
                {reservation.approvedAt && (
                  <Field
                    label={m.fieldApprovedAt}
                    className={!reservation.rejectedAt ? 'col-span-2' : undefined}
                  >
                    <span className="text-[13px] font-semibold text-success-700">
                      {formatDateTime(reservation.approvedAt)}
                    </span>
                  </Field>
                )}
                {reservation.rejectedAt && (
                  <Field
                    label={m.fieldRejectedAt}
                    className={!reservation.approvedAt ? 'col-span-2' : undefined}
                  >
                    <span className="text-[13px] font-semibold text-danger-600">
                      {formatDateTime(reservation.rejectedAt)}
                    </span>
                  </Field>
                )}
                {reservation.cancelledAt && (
                  <Field
                    label={m.fieldCancelledAt}
                    className={!reservation.convertedAt ? 'col-span-2' : undefined}
                  >
                    <span className="text-[13px] font-semibold text-danger-600">
                      {formatDateTime(reservation.cancelledAt)}
                    </span>
                  </Field>
                )}
                {reservation.convertedAt && (
                  <Field
                    label={m.fieldConvertedAt}
                    className={!reservation.cancelledAt ? 'col-span-2' : undefined}
                  >
                    <span className="text-[13px] font-semibold text-success-700">
                      {formatDateTime(reservation.convertedAt)}
                    </span>
                  </Field>
                )}
                {reservation.reason && (
                  <Field label={m.fieldReason} className="col-span-2">
                    <span className="text-[13px] font-medium text-slate-700">{reservation.reason}</span>
                  </Field>
                )}
                {reservation.notes && (
                  <Field label={m.fieldNotes} className="col-span-2">
                    <span className="text-[13px] font-medium text-slate-700">{reservation.notes}</span>
                  </Field>
                )}
              </div>
            </PremiumSectionCard>

            {/* Booking amount */}
            <PremiumSectionCard title={m.sectionBookingAmount}>
              <div className="space-y-4">
                {/* Installment plan / notes (rare) */}
                {(reservation.installmentPlanTemplate || reservation.bookingNotes) && (
                  <div className="space-y-4">
                    {reservation.installmentPlanTemplate && (
                      <Field label={m.fieldInstallmentPlan}>
                        <Link
                          href={`/dashboard/installments/${reservation.installmentPlanTemplate.id}` as never}
                          className="text-[13px] font-semibold text-brand-700 hover:underline"
                        >
                          {reservation.installmentPlanTemplate.name}
                        </Link>
                      </Field>
                    )}
                    {reservation.bookingNotes && (
                      <Field label={m.fieldBookingNotes}>
                        <span className="text-[13px] font-medium text-slate-700 whitespace-pre-wrap">
                          {reservation.bookingNotes}
                        </span>
                      </Field>
                    )}
                  </div>
                )}

                {/* Deposit receipts */}
                {bookingDeposits.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">
                      {m.depositLabel}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {bookingDeposits.map((dep) => (
                        <li
                          key={dep.id}
                          className="flex items-center gap-3.5 rounded-2xl bg-canvas/50 ring-1 ring-inset ring-hairline px-4 py-3.5"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                            <Banknote />
                          </span>
                          {/* Amount + date */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[17px] font-bold tabular-nums text-slate-900 leading-snug">
                              {Number(dep.amount).toLocaleString('ar-SA')}{' '}
                              <span className="text-[13px] font-medium text-slate-400">{symbol}</span>
                            </p>
                            <p className="text-[12px] text-slate-400 mt-0.5">{formatDate(dep.paidAt)}</p>
                          </div>
                          {/* Status + links on the same line */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={cn('text-[12px] font-semibold', dep.verified ? 'text-success-600' : 'text-amber-600')}>
                              {dep.verified ? m.depositVerified : m.depositNotVerified}
                            </span>
                            {dep.receiptUrl && (
                              <a
                                href={dep.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" /> {m.receiptLabel}
                              </a>
                            )}
                            <Link
                              href={`/dashboard/deposits/${dep.id}` as never}
                              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                            >
                              {m.depositDetailsLabel}
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {bookingDeposits.length > 1 && (
                      <p className="text-2xs text-amber-700">
                        {m.depositMultipleWarning}
                      </p>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <BookingPaymentActions
                    reservationId={reservation.id}
                    bookingPaymentStatus={reservation.bookingPaymentStatus}
                    reservationStatus={reservation.status}
                    bookingAmount={Number(reservation.bookingAmount)}
                    locale={locale}
                  />
                )}
              </div>
            </PremiumSectionCard>

            {/* Selected duration snapshot */}
            {reservation.selectedDurationMonths != null && (
              <PremiumSectionCard title={m.sectionInstallmentPlan}>
                <div className="space-y-5">
                  <p className="text-2xs text-slate-400">
                    {m.snapshotFrozenNote}
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label={m.fieldDuration}>
                      <span className="text-[14px] font-bold text-slate-900 tabular-nums">
                        {reservation.selectedDurationMonths} {m.monthSuffix}
                      </span>
                    </Field>
                    <Field label={m.fieldIncreaseRate}>
                      <span className="text-[14px] font-bold text-slate-900 tabular-nums">
                        {Number(reservation.selectedIncreasePercentage ?? 0)}%
                      </span>
                    </Field>
                    {reservation.snapshotDownPaymentAmount != null && (
                      <Field label={m.fieldDownPayment}>
                        <span className="text-[14px] font-bold text-slate-900 tabular-nums" dir="ltr">
                          {Number(reservation.snapshotDownPaymentAmount).toLocaleString('ar-SA')} {symbol}
                        </span>
                      </Field>
                    )}
                    {reservation.snapshotRemainingAmount != null && (
                      <Field label={m.fieldRemaining}>
                        <span className="text-[14px] font-bold text-slate-900 tabular-nums" dir="ltr">
                          {Number(reservation.snapshotRemainingAmount).toLocaleString('ar-SA')} {symbol}
                        </span>
                      </Field>
                    )}
                    {reservation.snapshotFinancedAmount != null && (
                      <Field label={m.fieldFinanced}>
                        <span className="text-[14px] font-bold text-slate-900 tabular-nums" dir="ltr">
                          {Number(reservation.snapshotFinancedAmount).toLocaleString('ar-SA')} {symbol}
                        </span>
                      </Field>
                    )}
                    {reservation.snapshotMonthlyInstallment != null && (
                      <Field label={m.fieldMonthly}>
                        <span className="text-[14px] font-bold text-brand-700 tabular-nums" dir="ltr">
                          {Number(reservation.snapshotMonthlyInstallment).toLocaleString('ar-SA', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {symbol}
                        </span>
                      </Field>
                    )}
                  </div>
                  {reservation.snapshotTotalPayable != null && (
                    <>
                      <div
                        className="h-[2px] rounded-full"
                        style={{ background: 'linear-gradient(to left, transparent, #e6c46a 30%, #b8923e 50%, #e6c46a 70%, transparent)' }}
                      />
                      <div className="flex items-end justify-between gap-4">
                        <Field label={m.fieldTotalPayable}>
                          <span className="text-[28px] font-black tabular-nums leading-none text-slate-900" dir="ltr">
                            {Number(reservation.snapshotTotalPayable).toLocaleString('ar-SA')}
                            <span className="text-[15px] font-semibold text-slate-400 ms-1.5">{symbol}</span>
                          </span>
                        </Field>
                      </div>
                    </>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            {/* Internal notes */}
            <PremiumSectionCard title={m.sectionInternalNotes}>
              <div className="space-y-4">
                <AddNoteForm reservationId={reservation.id} />
                {notes.length > 0 && (
                  <ul className="flex flex-col gap-2.5 mt-1">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="relative rounded-2xl bg-canvas/60 border border-hairline px-4 py-3"
                      >
                        <span className="absolute end-0 top-3 bottom-3 w-[3px] rounded-s-full bg-brand-400" />
                        <p className="text-[13.5px] text-slate-800 leading-relaxed pe-3">{note.body}</p>
                        <p className="text-2xs text-slate-400 mt-1.5 inline-flex items-center gap-1.5">
                          <span className="font-medium text-slate-500">
                            {note.author?.fullName ?? m.noteAuthorSystem}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>{formatDateTime(note.createdAt)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PremiumSectionCard>

            {/* Activity timeline — render ReservationTimeline directly to avoid duplicate header */}
            <PremiumSectionCard title={m.sectionActivity}>
              <ReservationTimeline activities={activities} />
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Quick navigation */}
            <PremiumCommandPanel title={m.sectionQuickActions}>
              {reservation.unit && (
                <Link href={`/dashboard/units/${reservation.unitId}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Home /></span>
                  <span>{m.cmdViewUnit}</span>
                </Link>
              )}
              {reservation.lead && (
                <Link href={`/dashboard/leads/${reservation.leadId}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><User /></span>
                  <span>{m.cmdViewLead}</span>
                </Link>
              )}
              {reservation.client && (
                <Link href={`/dashboard/clients/${reservation.clientId}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><User /></span>
                  <span>{m.cmdViewClient}</span>
                </Link>
              )}
              {project && (
                <Link href={`/dashboard/projects/${project.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Building2 /></span>
                  <span>{m.cmdViewProject}</span>
                </Link>
              )}
              {reservation.status === 'CONVERTED' && reservation.contract && (
                <Link href={`/dashboard/contracts/${reservation.contract.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><FileText /></span>
                  <span>{m.cmdViewContract}</span>
                </Link>
              )}
            </PremiumCommandPanel>

            {/* Linked contract */}
            {reservation.status === 'CONVERTED' && reservation.contract && (
              <PremiumSectionCard title={m.sectionLinkedContract} icon={<FileText />}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 [&_svg]:h-5 [&_svg]:w-5">
                    <FileText />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/contracts/${reservation.contract.id}` as never}
                      className="text-[13.5px] font-bold text-brand-700 hover:underline inline-flex items-center gap-1.5"
                    >
                      {reservation.contract.contractNumber ?? reservation.contract.id.slice(0, 8)}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                    {reservation.convertedAt && (
                      <p className="text-2xs text-slate-400 mt-0.5">
                        {m.contractConvertedAtPrefix}{formatDateTime(reservation.convertedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Convert to contract */}
            {isAdmin && reservation.status === 'APPROVED' && (
              <PremiumSectionCard title={m.sectionConvertToContract} icon={<FileText />}>
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
                  symbol={symbol}
                />
              </PremiumSectionCard>
            )}

            {/* Client / Lead */}
            <PremiumSectionCard title={m.sectionClientInfo} icon={<User />}>
              <div className="space-y-2.5">
                <p className="text-[15px] font-bold text-slate-900">{clientName}</p>
                {clientPhone && (
                  <a
                    href={`tel:${clientPhone}`}
                    className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <Phone />
                    </span>
                    <span className="text-sm font-medium text-slate-700" dir="ltr">{clientPhone}</span>
                  </a>
                )}
                {clientEmail && (
                  <a
                    href={`mailto:${clientEmail}`}
                    className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-50 text-info-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <Mail />
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate" dir="ltr">{clientEmail}</span>
                  </a>
                )}
                {reservation.lead && (
                  <Link
                    href={`/dashboard/leads/${reservation.leadId}` as never}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {m.linkViewLead}
                  </Link>
                )}
                {reservation.client && (
                  <Link
                    href={`/dashboard/clients/${reservation.clientId}` as never}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {m.linkViewClient}
                  </Link>
                )}
              </div>
            </PremiumSectionCard>

            {/* Unit */}
            {reservation.unit && (
              <PremiumSectionCard title={m.sectionUnitInfo} icon={<Home />}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/units/${reservation.unitId}` as never}
                      className="text-[16px] font-bold text-brand-700 hover:underline"
                    >
                      {reservation.unit.code}
                    </Link>
                    <UnitStatusBadge status={reservation.unit.status} />
                  </div>
                  {reservation.unit.type && (
                    <p className="text-xs text-slate-400 -mt-2">{reservation.unit.type}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label={m.fieldArea}>
                      <span className="text-[14px] font-bold text-slate-800 tabular-nums">
                        {reservation.unit.area} {m.areaSuffix}
                      </span>
                    </Field>
                    <Field label={m.fieldFloor}>
                      <span className="text-[14px] font-bold text-slate-800 tabular-nums">
                        {reservation.unit.floor}
                      </span>
                    </Field>
                    <Field label={m.fieldBedrooms}>
                      <span className="text-[14px] font-bold text-slate-800 tabular-nums">
                        {reservation.unit.bedrooms}
                      </span>
                    </Field>
                    <Field label={m.fieldPrice}>
                      <span className="text-[14px] font-bold text-slate-800 tabular-nums" dir="ltr">
                        {Number(reservation.unit.price).toLocaleString('ar-SA')} {symbol}
                      </span>
                    </Field>
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Project */}
            {project && (
              <PremiumSectionCard title={m.sectionProject} icon={<Building2 />}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-5 [&_svg]:w-5">
                    <Building2 />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/projects/${project.id}` as never}
                      className="text-[13.5px] font-bold text-brand-700 hover:underline truncate block"
                    >
                      {tx(project.name)}
                    </Link>
                    <p className="text-2xs text-slate-400 mt-0.5">{project.city}</p>
                  </div>
                </div>
              </PremiumSectionCard>
            )}

            {/* Sales person */}
            {reservation.sales && (
              <PremiumSectionCard title={m.sectionSalesAgent} icon={<User />}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-5 [&_svg]:w-5">
                    <User />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900">{reservation.sales.fullName}</p>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      {m.salesCreatedPrefix} {formatDate(reservation.createdAt)}
                    </p>
                  </div>
                </div>
              </PremiumSectionCard>
            )}
          </>
        }
      />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  );
}
