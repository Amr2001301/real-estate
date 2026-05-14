'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  confirmBookingPaymentAction,
  unconfirmBookingPaymentAction,
} from '../../actions';
import type { ReservationBookingPaymentStatus } from '@/lib/types';

interface Props {
  reservationId: string;
  bookingPaymentStatus: ReservationBookingPaymentStatus;
  reservationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  bookingAmount: number;
}

export function BookingPaymentActions({
  reservationId,
  bookingPaymentStatus,
  reservationStatus,
  bookingAmount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Only PENDING / APPROVED reservations allow booking payment changes
  const canEditPayment =
    reservationStatus === 'PENDING' || reservationStatus === 'APPROVED';

  if (!canEditPayment) return null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmBookingPaymentAction(reservationId);
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
      <div className="flex flex-wrap gap-2">
        {bookingPaymentStatus !== 'PAID' && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={pending}
            disabled={pending || bookingAmount <= 0}
            onClick={handleConfirm}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            تأكيد سداد مبلغ الحجز
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
            إلغاء تأكيد السداد
          </Button>
        )}
      </div>
      {bookingAmount <= 0 && bookingPaymentStatus !== 'PAID' && (
        <p className="text-xs text-amber-700">
          يجب تحديد مبلغ الحجز قبل تأكيد السداد
        </p>
      )}
    </div>
  );
}
