'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/field';
import { DocumentUploader, type UploadResult } from '@/components/documents/document-uploader';
import { convertReservationAction } from '../../actions';
import type { Reservation } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { periodicInstallmentLabel } from '@/lib/installment-frequency';
import { uiT } from '@/messages/ui';
import { ReservationBookingPaymentBadge } from '@/components/badges';

import { intlLocale } from '@/lib/format';
import { nowWallTime } from '@/lib/zoned-time';
import { LateFeeClauseField } from '@/components/form/late-fee-clause-field';
interface Props {
  reservation: Pick<
    Reservation,
    | 'id'
    | 'status'
    | 'bookingAmount'
    | 'bookingPaymentStatus'
    | 'installmentPlanTemplateId'
    | 'selectedDurationMonths'
    | 'selectedIncreasePercentage'
    | 'snapshotDownPaymentAmount'
    | 'snapshotMonthlyInstallment'
    | 'snapshotTotalPayable'
    | 'snapshotFrequency'
  > & {
    clientName: string;
    unitCode: string;
  };
  symbol: string;
  locale?: Locale;
}

export function ConvertReservationForm({ reservation, symbol, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // P8 — replace the raw "paste a URL" input with a signed upload. The picked
  // file is sent through the existing /documents/presign flow, which validates
  // MIME (PDF / JPEG / PNG / WebP / Word / Excel / CSV) and size (≤25 MiB)
  // server-side before minting an R2 PUT URL. The resulting public R2 URL +
  // file metadata are sent on the convert payload (pdfUrl/fileName/mimeType/
  // sizeBytes). P12 — the convert endpoint then registers a CUSTOMER_VISIBLE
  // CONTRACT document (visible in the Documents Center + downloadable by the
  // customer). The /me/contracts endpoint redacts pdfUrl to null — customers
  // only ever reach the file through the signed-download endpoint (≤5 min
  // URLs, just-in-time ownership check).
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);

  const bookingAmount = Number(reservation.bookingAmount);
  const paymentBlocking =
    bookingAmount > 0 &&
    reservation.bookingPaymentStatus !== 'PAID' &&
    reservation.bookingPaymentStatus !== 'WAIVED';

  // A reservation linked to a plan template MUST have the full duration snapshot
  // before conversion. If any snapshot field is missing the backend will reject it
  // and the contract would be created with wrong amounts / no installment plan.
  const snapshotMissing =
    reservation.installmentPlanTemplateId != null &&
    (reservation.selectedDurationMonths == null ||
      reservation.snapshotDownPaymentAmount == null ||
      reservation.snapshotMonthlyInstallment == null ||
      reservation.snapshotTotalPayable == null);

  const needsStartDate = reservation.selectedDurationMonths != null;
  const fmt = (v: string | number, frac = 0) =>
    Number(v).toLocaleString(intlLocale(locale), { minimumFractionDigits: frac, maximumFractionDigits: frac });

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await convertReservationAction(reservation.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/contracts/${result.contractId}`);
    });
  }

  // Snapshot missing: show hard block, do not render the form at all.
  if (snapshotMissing) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{m.convertSnapshotMissing}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          onClick={() => setOpen(true)}
          disabled={paymentBlocking}
          leftIcon={<ArrowLeftRight className="h-4 w-4" />}
        >
          {m.convertBtn}
        </Button>
      ) : null}

      {paymentBlocking && !open && (
        <div className="flex items-start gap-2 rounded-xl bg-warning-50 border border-warning-100 text-warning-700 p-3 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{m.convertPaymentBlockWarning}</p>
        </div>
      )}

      {open && (
        <div data-testid="convert-form" className="space-y-5">
          {/* Read-only summary */}
          <dl className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline text-[13px]">
            <SummaryRow label={m.convertClientLabel}>{reservation.clientName}</SummaryRow>
            <SummaryRow label={m.convertUnitLabel}>
              <span className="font-mono">{reservation.unitCode}</span>
            </SummaryRow>
            {bookingAmount > 0 && (
              <SummaryRow label={m.convertBookingAmountLabel}>
                <span className="inline-flex items-center gap-2">
                  <span className="tabular-nums" dir="ltr">{fmt(bookingAmount)} {symbol}</span>
                  <ReservationBookingPaymentBadge status={reservation.bookingPaymentStatus} locale={locale} />
                </span>
              </SummaryRow>
            )}
            {reservation.snapshotDownPaymentAmount != null && (
              <SummaryRow label={m.convertDownPaymentLabel}>
                <span className="tabular-nums" dir="ltr">{fmt(reservation.snapshotDownPaymentAmount)} {symbol}</span>
              </SummaryRow>
            )}
            {reservation.selectedDurationMonths != null && (
              <SummaryRow label={m.convertDurationLabel}>
                <span className="tabular-nums">
                  {reservation.selectedDurationMonths} {m.monthSuffix}
                  {reservation.selectedIncreasePercentage != null &&
                    ` · ${m.convertIncreaseLabel} ${Number(reservation.selectedIncreasePercentage)}%`}
                </span>
              </SummaryRow>
            )}
            {reservation.snapshotMonthlyInstallment != null && (
              <SummaryRow label={periodicInstallmentLabel(reservation.snapshotFrequency, locale) ?? m.convertMonthlyLabel}>
                <span className="font-bold tabular-nums text-brand-700" dir="ltr">
                  {fmt(reservation.snapshotMonthlyInstallment, 2)} {symbol}
                </span>
              </SummaryRow>
            )}
            {reservation.snapshotTotalPayable != null && (
              <div className="flex items-center justify-between gap-3 bg-brand-500/[0.08] px-4 py-3">
                <dt className="font-semibold text-slate-600">{m.convertTotalLabel}</dt>
                <dd className="num text-[22px] font-semibold leading-none text-slate-900" dir="ltr">
                  {fmt(reservation.snapshotTotalPayable)}
                  <span className="ms-1.5 font-sans text-[12px] font-medium text-slate-500">{symbol}</span>
                </dd>
              </div>
            )}
          </dl>

          {/* Form inputs */}
          <form action={handleSubmit} className="space-y-4">
            {needsStartDate && (
              <Field
                label={m.convertStartDateLabel}
                name="startsAt"
                required
                hint={m.convertStartDateHint}
              >
                <input
                  name="startsAt"
                  type="date"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                {/* A start date in the past: the rows already due come in
                    overdue (without late fees) — the admin records what was paid. */}
                {startsAt && startsAt < nowWallTime().slice(0, 10) && (
                  <p data-testid="backdated-warning" className="mt-1 text-xs text-amber-700">
                    {m.convertBackdatedWarning}
                  </p>
                )}
              </Field>
            )}

            <LateFeeClauseField locale={locale} />

            <Field label={m.convertSignedAtLabel} name="signedAt">
              <input
                name="signedAt"
                type="datetime-local"
                className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </Field>

            {/* P8 — Upload the contract document (PDF or image). On success
                we capture the R2 public URL in `uploaded.fileUrl`; the hidden
                `pdfUrl` field below sends it as the existing convert payload
                so the contracts service can register the CONTRACT document.
                Customers never receive this raw URL — see /me/contracts. */}
            <Field
              label={m.convertContractDocLabel}
              name="contractDocument"
              hint={m.convertContractDocHint}
            >
              <DocumentUploader
                onUploaded={setUploaded}
                onCleared={() => setUploaded(null)}
              />
            </Field>
            <input type="hidden" name="pdfUrl" value={uploaded?.fileUrl ?? ''} />
            <input type="hidden" name="fileName" value={uploaded?.fileName ?? ''} />
            <input type="hidden" name="mimeType" value={uploaded?.mimeType ?? ''} />
            <input
              type="hidden"
              name="sizeBytes"
              value={uploaded?.sizeBytes != null ? String(uploaded.sizeBytes) : ''}
            />

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? m.convertInProgressBtn : m.convertConfirmBtn}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setOpen(false); setError(null); }}
                disabled={isPending}
              >
                {m.convertCancelBtn}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end font-semibold text-slate-900">{children}</dd>
    </div>
  );
}
