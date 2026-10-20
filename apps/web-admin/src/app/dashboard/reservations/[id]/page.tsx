import Link from 'next/link';
import {
  Phone,
  Mail,
  Building2,
  ExternalLink,
  AlertCircle,
  Clock,
  Home,
  FileText,
  Banknote,
  BadgeCheck,
  CalendarClock,
  ArrowUpLeft,
  Check,
  X,
  Hourglass,
  Circle,
  FileSignature,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import { getSession } from '@/lib/session';
import type { Reservation } from '@/lib/types';
import { formatDate, formatDateTime, tx, intlLocale } from '@/lib/format';
import { getReportsCurrency, currencySymbol } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { periodicInstallmentLabel } from '@/lib/installment-frequency';
import { printT } from '@/messages/print';
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
  PremiumPanel,
  PremiumEmptyNote,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

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
  const symbol = currencySymbol(currency, locale);
  const isAdmin = session?.role === 'ADMIN';
  const salesOptions =
    reservation.status === 'PENDING'
      ? (
          await safe(
            staffOptions(['SALES', 'SALES_MANAGER'], { active: true }),
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

  const nf = (v: string | number | null | undefined, frac = 0) =>
    Number(v ?? 0).toLocaleString(intlLocale(locale), {
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    });
  const bookingAmount = Number(reservation.bookingAmount ?? 0);
  const daysLeft = Math.ceil((new Date(reservation.expiresAt).getTime() - Date.now()) / 86_400_000);
  const isLive = reservation.status === 'PENDING' || reservation.status === 'APPROVED';
  const steps = journeySteps(reservation, m);
  const down = Number(reservation.snapshotDownPaymentAmount ?? 0);
  const financed = Number(reservation.snapshotFinancedAmount ?? 0);
  const downPct = down + financed > 0 ? Math.round((down / (down + financed)) * 100) : 0;

  return (
    <div className="space-y-6">
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
            <ReservationStatusBadge status={reservation.status} locale={locale} />
            {isExpired && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-500/12 px-2.5 py-0.5 text-xs font-semibold text-danger-600">
                <Clock className="h-3.5 w-3.5" />
                {m.expiredBadge}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <PrintButton path="reservations" id={reservation.id} label={printT(locale).common.print} />
            <ReservationDetailActions
              reservationId={reservation.id}
              status={reservation.status}
              currentSalesId={reservation.salesId}
              currentNotes={reservation.notes}
              salesOptions={salesOptions.map((s) => ({
                id: s.id,
                fullName: s.fullName,
                // salesActorLabel needs it: without it managers read "مبيعات".
                role: s.role,
              }))}
              canManage={isAdmin}
              canDecide={
                isAdmin ||
                (session?.role === 'SALES_MANAGER' && reservation.salesId !== session.id)
              }
              hasBroker={!!reservation.brokerId}
              locale={locale}
            />
          </div>
        }
      >
        {/* Key figures */}
        <div
          data-testid="reservation-kpis"
          className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-hairline bg-surface lg:grid-cols-4"
        >
          <Kpi label={m.kpiUnitPrice} icon={<Home />}>
            {reservation.unit ? (
              <Money value={nf(reservation.unit.price)} symbol={symbol} />
            ) : (
              '—'
            )}
          </Kpi>
          <Kpi
            label={m.kpiBookingAmount}
            icon={<Banknote />}
            foot={<ReservationBookingPaymentBadge status={reservation.bookingPaymentStatus} locale={locale} />}
          >
            <Money value={nf(bookingAmount)} symbol={symbol} />
          </Kpi>
          <Kpi
            label={periodicInstallmentLabel(reservation.snapshotFrequency, locale) ?? m.fieldMonthly}
            icon={<CalendarClock />}
            foot={
              reservation.selectedDurationMonths != null ? (
                <span className="text-[12px] text-slate-500 tabular-nums">
                  {reservation.selectedDurationMonths} {m.monthSuffix}
                </span>
              ) : undefined
            }
          >
            {reservation.snapshotMonthlyInstallment != null ? (
              <Money value={nf(reservation.snapshotMonthlyInstallment, 2)} symbol={symbol} gold />
            ) : (
              '—'
            )}
          </Kpi>
          {reservation.contract ? (
            <Kpi label={m.kpiContract} icon={<FileText />}>
              <Link
                href={`/dashboard/contracts/${reservation.contract.id}` as never}
                className="inline-flex items-center gap-1.5 font-mono text-[17px] font-bold text-brand-700 hover:text-brand-600"
              >
                {reservation.contract.contractNumber ?? reservation.contract.id.slice(0, 8)}
                <ArrowUpLeft className="h-4 w-4 ltr:rotate-90" />
              </Link>
            </Kpi>
          ) : (
            <Kpi
              label={m.kpiExpiry}
              icon={<Clock />}
              foot={
                isLive ? (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                      isExpired
                        ? 'bg-danger-500/12 text-danger-600'
                        : daysLeft <= 3
                          ? 'bg-amber-500/12 text-amber-600'
                          : 'bg-emerald-500/12 text-emerald-600',
                    )}
                  >
                    {isExpired ? m.expiredBadge : m.daysLeft(daysLeft)}
                  </span>
                ) : undefined
              }
            >
              <span className={cn('num text-[24px] font-semibold', isExpired ? 'text-danger-600' : 'text-slate-900')}>
                {formatDate(reservation.expiresAt, locale)}
              </span>
            </Kpi>
          )}
        </div>
      </PremiumPageHero>

      <PremiumDetailLayout
        main={
          <>
            {/* Journey */}
            <PremiumPanel title={m.sectionJourney} sub={m.journeySub}>
              <ol data-testid="reservation-journey" className="grid grid-cols-3">
                {steps.map((st, i) => (
                  <li key={st.key} className="relative flex flex-col items-center px-2 text-center">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute top-[22px] h-[2px] w-[calc(100%-56px)] end-[calc(50%+28px)]',
                          st.tone === 'todo' || st.tone === 'current'
                            ? 'bg-hairline'
                            : st.tone === 'bad'
                              ? 'bg-danger-500/40'
                              : 'bg-gradient-to-l from-brand-500 to-brand-400',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]',
                        st.tone === 'done' && 'bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408] shadow-[0_6px_18px_-6px_rgba(201,162,77,0.7)]',
                        st.tone === 'bad' && 'bg-danger-500/15 text-danger-600 ring-1 ring-danger-500/40',
                        st.tone === 'current' && 'bg-surface text-brand-600 ring-2 ring-brand-500/70 ring-offset-4 ring-offset-surface',
                        st.tone === 'todo' && 'bg-surface-muted text-slate-400 ring-1 ring-hairline',
                      )}
                    >
                      {st.tone === 'done' ? <Check /> : st.tone === 'bad' ? <X /> : st.tone === 'current' ? <Hourglass /> : <Circle />}
                    </span>
                    <p
                      className={cn(
                        'mt-3 text-[13.5px] font-bold',
                        st.tone === 'todo' ? 'text-slate-400' : st.tone === 'bad' ? 'text-danger-600' : 'text-slate-900',
                      )}
                    >
                      {st.label}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500 tabular-nums">
                      {st.at ? formatDateTime(st.at, locale) : m.stepNotYet}
                    </p>
                  </li>
                ))}
              </ol>

              {(reservation.reason || reservation.notes) && (
                <div className="mt-6 grid gap-3 border-t border-hairline pt-5">
                  {reservation.reason && (
                    <Quote label={m.fieldReason} tone="danger">{reservation.reason}</Quote>
                  )}
                  {reservation.notes && <Quote label={m.fieldNotes}>{reservation.notes}</Quote>}
                </div>
              )}
            </PremiumPanel>

            {/* Booking amount */}
            <PremiumPanel
              title={m.sectionBookingAmount}
              trailing={<ReservationBookingPaymentBadge status={reservation.bookingPaymentStatus} locale={locale} />}
            >
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
                  <Quote label={m.fieldBookingNotes}>{reservation.bookingNotes}</Quote>
                )}

                {bookingDeposits.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {bookingDeposits.map((dep) => (
                      <li
                        key={dep.id}
                        className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-surface-muted/50 px-5 py-4"
                      >
                        <span
                          className={cn(
                            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px]',
                            dep.verified ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600',
                          )}
                        >
                          {dep.verified ? <BadgeCheck /> : <Banknote />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] text-slate-500">{m.depositLabel}</p>
                          <Money value={nf(dep.amount)} symbol={symbol} />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-end">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                                dep.verified ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600',
                              )}
                            >
                              <span className={cn('h-1.5 w-1.5 rounded-full', dep.verified ? 'bg-emerald-500' : 'bg-amber-500')} />
                              {dep.verified ? m.depositVerified : m.depositNotVerified}
                            </span>
                            <p className="mt-1 text-[12px] text-slate-500 tabular-nums">{formatDate(dep.paidAt, locale)}</p>
                          </div>
                          <span className="h-9 w-px bg-hairline" aria-hidden />
                          <div className="flex flex-col items-start gap-1">
                            <Link
                              href={`/dashboard/deposits/${dep.id}` as never}
                              className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-700 hover:text-brand-600"
                            >
                              {m.depositDetailsLabel}
                              <ArrowUpLeft className="h-3.5 w-3.5 ltr:rotate-90" />
                            </Link>
                            {dep.receiptUrl && (
                              <a
                                href={dep.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-brand-700"
                              >
                                <ExternalLink className="h-3 w-3" /> {m.receiptLabel}
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PremiumEmptyNote>
                    {m.noDeposits}
                    {bookingAmount > 0 && (
                      <span className="mt-1 block text-slate-900">
                        {m.bookingRequired}: <span className="font-bold tabular-nums">{nf(bookingAmount)} {symbol}</span>
                      </span>
                    )}
                  </PremiumEmptyNote>
                )}
                {bookingDeposits.length > 1 && (
                  <p className="text-[12px] text-amber-600">{m.depositMultipleWarning}</p>
                )}

                {isAdmin && (
                  <BookingPaymentActions
                    reservationId={reservation.id}
                    bookingPaymentStatus={reservation.bookingPaymentStatus}
                    reservationStatus={reservation.status}
                    bookingAmount={bookingAmount}
                    locale={locale}
                  />
                )}
              </div>
            </PremiumPanel>

            {/* Selected plan snapshot */}
            {reservation.selectedDurationMonths != null && (
              <PremiumPanel
                title={m.sectionInstallmentPlan}
                sub={m.snapshotFrozenNote}
                trailing={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/12 px-3 py-1 text-[12px] font-semibold text-brand-700 tabular-nums">
                    {reservation.selectedDurationMonths} {m.monthSuffix}
                    <span className="text-brand-500/60">·</span>
                    {Number(reservation.selectedIncreasePercentage ?? 0)}%
                  </span>
                }
              >
                <div data-testid="reservation-plan" className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {reservation.snapshotDownPaymentAmount != null && (
                      <PlanTile label={m.fieldDownPayment} value={nf(reservation.snapshotDownPaymentAmount)} symbol={symbol} />
                    )}
                    {reservation.snapshotFinancedAmount != null && (
                      <PlanTile label={m.fieldFinanced} value={nf(reservation.snapshotFinancedAmount)} symbol={symbol} />
                    )}
                    {reservation.snapshotMonthlyInstallment != null && (
                      <PlanTile
                        label={periodicInstallmentLabel(reservation.snapshotFrequency, locale) ?? m.fieldMonthly}
                        value={nf(reservation.snapshotMonthlyInstallment, 2)}
                        symbol={symbol}
                        gold
                      />
                    )}
                  </div>

                  {down + financed > 0 && (
                    <div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
                        <span className="h-full bg-gradient-to-l from-brand-400 to-brand-600" style={{ width: `${downPct}%` }} />
                        <span className="h-full flex-1 bg-slate-400/35" />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-[12px] text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-brand-500" />
                          {m.planDownShare} <span className="font-semibold text-slate-900 tabular-nums">{downPct}%</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          {m.planFinancedShare} <span className="font-semibold text-slate-900 tabular-nums">{100 - downPct}%</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {reservation.snapshotTotalPayable != null && (
                    <div className="relative overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-l from-brand-500/[0.12] via-brand-500/[0.04] to-transparent px-6 py-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <p className="text-[13px] font-semibold text-slate-600">{m.fieldTotalPayable}</p>
                        <p className="num text-[40px] font-semibold leading-none text-slate-900" dir="ltr">
                          {nf(reservation.snapshotTotalPayable)}
                          <span className="ms-2 font-sans text-[15px] font-medium text-slate-500">{symbol}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </PremiumPanel>
            )}

            {/* Notes + activity */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <PremiumPanel
                title={m.sectionInternalNotes}
                trailing={notes.length > 0 ? <CountPill n={notes.length} /> : undefined}
              >
                <div className="space-y-4">
                  {notes.length > 0 ? (
                    <ul className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto">
                      {notes.map((note) => (
                        <li key={note.id} className="relative rounded-2xl border border-hairline bg-surface-muted/50 px-4 py-3">
                          <span className="absolute end-0 top-3 bottom-3 w-[3px] rounded-s-full bg-brand-500" />
                          <p className="pe-3 text-[13.5px] leading-relaxed text-slate-800">{note.body}</p>
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
                            <span className="font-semibold">{note.author?.fullName ?? m.noteAuthorSystem}</span>
                            <span className="text-slate-400">·</span>
                            <span className="tabular-nums">{formatDateTime(note.createdAt, locale)}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <PremiumEmptyNote>{m.notesEmpty}</PremiumEmptyNote>
                  )}
                  <AddNoteForm reservationId={reservation.id} locale={locale} />
                </div>
              </PremiumPanel>

              <PremiumPanel
                title={m.sectionActivity}
                trailing={activities.length > 0 ? <CountPill n={activities.length} /> : undefined}
              >
                <ReservationTimeline activities={activities} locale={locale} />
              </PremiumPanel>
            </div>
          </>
        }
        side={
          <>
            {/* Convert to contract */}
            {isAdmin && reservation.status === 'APPROVED' && (
              <section
                data-testid="reservation-convert"
                className="relative overflow-hidden rounded-[22px] border border-brand-500/30 bg-surface"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.14] via-transparent to-transparent" />
                <div className="relative p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[#1a1408] [&_svg]:h-5 [&_svg]:w-5">
                      <FileSignature />
                    </span>
                    <div>
                      <h2 className="font-heading text-[19px] font-bold text-slate-900">{m.sectionConvertToContract}</h2>
                      <p className="text-[12.5px] text-slate-500">{m.convertSub}</p>
                    </div>
                  </div>
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
                      snapshotFrequency: reservation.snapshotFrequency ?? null,
                      snapshotTotalPayable: reservation.snapshotTotalPayable ?? null,
                      clientName,
                      unitCode: reservation.unit?.code ?? '—',
                    }}
                    symbol={symbol}
                    locale={locale}
                  />
                </div>
              </section>
            )}

            {/* Parties: client, unit, project, sales */}
            <PremiumPanel title={m.sectionParties} sub={m.partiesSub} padding="none">
              <div data-testid="reservation-parties" className="divide-y divide-hairline border-t border-hairline">
                <div className="px-6 py-5">
                  <PartyLabel>{m.partyClient}</PartyLabel>
                  <div className="flex items-center gap-3.5">
                    <Avatar name={clientName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-slate-900">{clientName}</p>
                      {(reservation.client || reservation.lead) && (
                        <Link
                          href={
                            (reservation.client
                              ? `/dashboard/clients/${reservation.clientId}`
                              : `/dashboard/leads/${reservation.leadId}`) as never
                          }
                          className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-700 hover:text-brand-600"
                        >
                          {reservation.client ? m.linkViewClient : m.linkViewLead}
                          <ArrowUpLeft className="h-3.5 w-3.5 ltr:rotate-90" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {(clientPhone || clientEmail) && (
                    <div className="mt-4 flex flex-col gap-2">
                      {clientPhone && (
                        <ContactRow href={`tel:${clientPhone}`} icon={<Phone />}>{clientPhone}</ContactRow>
                      )}
                      {clientEmail && (
                        <ContactRow href={`mailto:${clientEmail}`} icon={<Mail />}>{clientEmail}</ContactRow>
                      )}
                    </div>
                  )}
                </div>

                {reservation.unit && (
                  <div className="px-6 py-5">
                    <PartyLabel>{m.partyUnit}</PartyLabel>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/dashboard/units/${reservation.unitId}` as never}
                          className="font-mono text-[18px] font-bold text-slate-900 hover:text-brand-700"
                        >
                          {reservation.unit.code}
                        </Link>
                        {reservation.unit.type && (
                          <p className="text-[12px] text-slate-500">{reservation.unit.type}</p>
                        )}
                      </div>
                      <UnitStatusBadge status={reservation.unit.status} locale={locale} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-hairline">
                      <UnitStat label={m.fieldArea} value={`${reservation.unit.area} ${m.areaSuffix}`} />
                      <UnitStat label={m.fieldFloor} value={String(reservation.unit.floor ?? '—')} />
                      <UnitStat label={m.fieldBedrooms} value={String(reservation.unit.bedrooms ?? '—')} />
                    </div>
                  </div>
                )}

                {project && (
                  <Link
                    href={`/dashboard/projects/${project.id}` as never}
                    className="group flex items-center gap-3.5 px-6 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
                      <Building2 />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-slate-500">{m.partyProject}</p>
                      <p className="truncate text-[14px] font-bold text-slate-900">{tx(project.name)}</p>
                      {project.city && <p className="text-[12px] text-slate-500">{project.city}</p>}
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-600 ltr:rotate-90" />
                  </Link>
                )}

                {reservation.sales && (
                  <div className="flex items-center gap-3.5 px-6 py-4">
                    <Avatar name={reservation.sales.fullName} small />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-slate-500">{m.partySales}</p>
                      <p className="truncate text-[14px] font-bold text-slate-900">{reservation.sales.fullName}</p>
                      <p className="text-[12px] text-slate-500 tabular-nums">
                        {m.salesCreatedPrefix} {formatDate(reservation.createdAt, locale)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </PremiumPanel>
          </>
        }
      />
    </div>
  );
}

type Msg = ReturnType<typeof uiT>['pages']['reservationDetailPage'];
type Step = { key: string; label: string; at: string | null; tone: 'done' | 'bad' | 'current' | 'todo' };

/** Three steps: created → approved (or rejected/expired/cancelled) → contract. */
function journeySteps(r: Reservation, m: Msg): Step[] {
  const steps: Step[] = [{ key: 'created', label: m.stepCreated, at: r.createdAt, tone: 'done' }];
  if (r.rejectedAt) {
    steps.push({ key: 'decision', label: m.stepRejected, at: r.rejectedAt, tone: 'bad' });
  } else if (r.approvedAt) {
    steps.push({ key: 'decision', label: m.stepApproved, at: r.approvedAt, tone: 'done' });
  } else if (r.status === 'EXPIRED') {
    steps.push({ key: 'decision', label: m.stepExpired, at: r.expiresAt, tone: 'bad' });
  } else if (r.cancelledAt) {
    steps.push({ key: 'decision', label: m.stepCancelled, at: r.cancelledAt, tone: 'bad' });
  } else {
    steps.push({ key: 'decision', label: m.stepAwaitingApproval, at: null, tone: 'current' });
  }
  const stopped = steps[1]!.tone === 'bad';
  if (r.convertedAt) {
    steps.push({ key: 'contract', label: m.stepConverted, at: r.convertedAt, tone: 'done' });
  } else if (!stopped && r.cancelledAt) {
    steps.push({ key: 'contract', label: m.stepCancelled, at: r.cancelledAt, tone: 'bad' });
  } else if (!stopped && r.status === 'EXPIRED') {
    steps.push({ key: 'contract', label: m.stepExpired, at: r.expiresAt, tone: 'bad' });
  } else {
    steps.push({
      key: 'contract',
      label: m.stepConverted,
      at: null,
      tone: !stopped && r.status === 'APPROVED' ? 'current' : 'todo',
    });
  }
  return steps;
}

function Money({ value, symbol, gold }: { value: string; symbol: string; gold?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" dir="ltr">
      <span className={cn('num text-[26px] font-semibold leading-none', gold ? 'text-brand-700' : 'text-slate-900')}>
        {value}
      </span>
      <span className="text-[12.5px] font-medium text-slate-500">{symbol}</span>
    </span>
  );
}

function Kpi({
  label,
  icon,
  foot,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-hairline p-5 [&:not(:first-child)]:border-s max-lg:[&:nth-child(3)]:border-s-0 max-lg:[&:nth-child(n+3)]:border-t">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
        {label}
      </div>
      <div className="min-h-[28px]">{children}</div>
      {foot && <div>{foot}</div>}
    </div>
  );
}

function PlanTile({ label, value, symbol, gold }: { label: string; value: string; symbol: string; gold?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4',
        gold ? 'border-brand-500/30 bg-brand-500/[0.07]' : 'border-hairline bg-surface-muted/50',
      )}
    >
      <p className="text-[12px] font-semibold text-slate-500">{label}</p>
      <div className="mt-2">
        <Money value={value} symbol={symbol} gold={gold} />
      </div>
    </div>
  );
}

function Quote({ label, tone, children }: { label: string; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border px-5 py-4',
        tone === 'danger' ? 'border-danger-500/25 bg-danger-500/[0.06]' : 'border-hairline bg-surface-muted/50',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute end-0 top-4 bottom-4 w-[3px] rounded-s-full', tone === 'danger' ? 'bg-danger-500' : 'bg-brand-500')}
      />
      <p className="text-[11.5px] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap pe-3 text-[13.5px] leading-relaxed text-slate-800">{children}</p>
    </div>
  );
}

function CountPill({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-semibold text-slate-600 tabular-nums">
      {n}
    </span>
  );
}

function PartyLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11.5px] font-semibold text-slate-500">{children}</p>;
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading font-bold text-brand-700 ring-1 ring-brand-500/40',
        small ? 'h-10 w-10 text-[14px]' : 'h-12 w-12 text-[16px]',
      )}
    >
      {initials || '—'}
    </span>
  );
}

function ContactRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-2.5 transition-colors hover:border-brand-500/40 hover:bg-brand-500/[0.05]"
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500 group-hover:text-brand-700 [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
      </span>
      <span className="truncate text-[13px] font-medium text-slate-700" dir="ltr">{children}</span>
    </a>
  );
}

function UnitStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center [&:not(:first-child)]:border-s [&:not(:first-child)]:border-hairline">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-bold text-slate-900 tabular-nums">{value}</p>
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
