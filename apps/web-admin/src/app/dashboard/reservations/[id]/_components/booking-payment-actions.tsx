'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  confirmBookingPaymentAction,
  unconfirmBookingPaymentAction,
} from '../../actions';
import type { ReservationBookingPaymentStatus } from '@/lib/types';

interface Props {
  reservationId: string;
  bookingPaymentStatus: ReservationBookingPaymentStatus;
  reservationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED';
  bookingAmount: number;
  locale?: Locale;
}

export function BookingPaymentActions({
  reservationId,
  bookingPaymentStatus,
  reservationStatus,
  bookingAmount,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState('');
  const [cheque, setCheque] = useState({ number: '', bank: '', dueDate: '' });

  // Only PENDING / APPROVED reservations allow booking payment changes
  const canEditPayment =
    reservationStatus === 'PENDING' || reservationStatus === 'APPROVED';

  if (!canEditPayment) return null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set('paymentMethod', method);
      if (method === 'CHEQUE') {
        form.set('chequeNumber', cheque.number);
        form.set('drawerBankName', cheque.bank);
        form.set('chequeDueDate', cheque.dueDate);
      }
      const res = await confirmBookingPaymentAction(reservationId, form);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function handleUnconfirm() {
    setError(null);
    startTransition(async () => {
      const res = await unconfirmBookingPaymentAction(reservationId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-2.5 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {bookingPaymentStatus === 'PENDING' && (
        // A proof or a cheque is already on its way: settle it, don't record another.
        <p data-testid="booking-payment-waiting" className="rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700">
          {locale === 'en'
            ? 'A payment proof or cheque for this booking is waiting — review it in the payments below (or on the Cheques page).'
            : 'يوجد إيصال أو شيك لمبلغ الحجز بانتظار الحسم — راجِعه من الدفعات أدناه (أو من صفحة الشيكات).'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {bookingPaymentStatus === 'UNPAID' && (
          <select
            aria-label={m.bookingPaymentMethodLabel}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={pending || bookingAmount <= 0}
            className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="" disabled>
              {m.bookingPaymentMethodChoose}
            </option>
            {(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const).map((k) => (
              <option key={k} value={k}>
                {m.bookingPaymentMethods[k]}
              </option>
            ))}
          </select>
        )}
        {bookingPaymentStatus === 'UNPAID' && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={
              pending || bookingAmount <= 0 || !method || (method === 'CHEQUE' && (!cheque.number || !cheque.dueDate))
            }
            onClick={handleConfirm}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            {m.bookingPaymentConfirmBtn}
          </Button>
        )}
        {bookingPaymentStatus === 'PAID' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={pending}
            disabled={pending}
            onClick={handleUnconfirm}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            {m.bookingPaymentUnconfirmBtn}
          </Button>
        )}
      </div>
      {method === 'CHEQUE' && bookingPaymentStatus === 'UNPAID' && (
        <div data-testid="booking-cheque-fields" className="flex flex-col gap-2">
          <p className="text-xs text-amber-700">{m.bookingPaymentChequeHint}</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['number', m.bookingChequeNumber, 'text'],
                ['bank', m.bookingChequeBank, 'text'],
                ['dueDate', m.bookingChequeDueDate, 'date'],
              ] as const
            ).map(([key, label, type]) => (
              <input
                key={key}
                type={type}
                aria-label={label}
                placeholder={label}
                value={cheque[key]}
                onChange={(e) => setCheque((c) => ({ ...c, [key]: e.target.value }))}
                className="rounded-xl border border-hairline bg-surface px-3 py-2 text-[13px] text-slate-800"
              />
            ))}
          </div>
        </div>
      )}
      {bookingAmount <= 0 && bookingPaymentStatus === 'UNPAID' && (
        <p className="text-xs text-amber-700">
          {m.bookingPaymentAmountRequired}
        </p>
      )}
    </div>
  );
}
