'use client';

import { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { SubmitPaymentProofForm } from './SubmitPaymentProofForm';

/**
 * Gap 3 — customer-facing entry point to submit (or resubmit) a payment proof
 * for a reservation's booking amount. Rendered inside the (server) reservation
 * card; toggles the shared SubmitPaymentProofForm in reservation mode. Keeps
 * the warm-luxe account styling (navy CTA, gold/error accents).
 */
export function BookingPaymentProof({
  reservationId,
  bookingAmount,
  rejected,
  rejectionReason,
  locale,
}: {
  reservationId: string;
  bookingAmount: string;
  /** When the previous proof was rejected, show the reason + a resubmit CTA. */
  rejected?: boolean;
  rejectionReason?: string | null;
  locale: Locale;
}) {
  const m = siteT(locale).accountPages.bookingPaymentProof;
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      {rejected && rejectionReason && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{m.rejectedTitle}</p>
            <p className="mt-0.5">{rejectionReason}</p>
          </div>
        </div>
      )}

      {open ? (
        <SubmitPaymentProofForm
          reservationId={reservationId}
          amount={bookingAmount}
          onClose={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {rejected ? m.resubmit : m.submit}
        </button>
      )}
    </div>
  );
}
