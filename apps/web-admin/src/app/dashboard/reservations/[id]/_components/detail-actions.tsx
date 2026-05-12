'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, X, Ban } from 'lucide-react';
import type { ReservationStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { StatusDialog } from '../../_components/status-dialog';
import {
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction,
} from '../../actions';

const FINAL: ReservationStatus[] = ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

interface Props {
  reservationId: string;
  status: ReservationStatus;
}

export function ReservationDetailActions({ reservationId, status }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approvePending, startApprove] = useTransition();

  if (FINAL.includes(status)) return null;

  function handleApprove() {
    if (!window.confirm('هل أنت متأكد من الموافقة على هذا الحجز؟')) return;
    startApprove(async () => {
      await approveReservationAction(reservationId);
    });
  }

  return (
    <>
      <Button
        variant="primary"
        size="md"
        leftIcon={<CheckCircle2 className="h-4 w-4" />}
        loading={approvePending}
        onClick={handleApprove}
      >
        موافقة
      </Button>

      <Button
        variant="outline"
        size="md"
        leftIcon={<X className="h-4 w-4" />}
        onClick={() => setRejectOpen(true)}
        className="text-danger-600 border-danger-200 hover:bg-danger-50"
      >
        رفض
      </Button>

      <Button
        variant="outline"
        size="md"
        leftIcon={<Ban className="h-4 w-4" />}
        onClick={() => setCancelOpen(true)}
      >
        إلغاء
      </Button>

      <StatusDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="رفض الحجز"
        description="هل أنت متأكد من رفض هذا الحجز؟ سيتم إعادة الوحدة إلى حالة متاحة."
        confirmLabel="تأكيد الرفض"
        confirmVariant="danger"
        action={rejectReservationAction.bind(null, reservationId)}
      />

      <StatusDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="إلغاء الحجز"
        description="هل أنت متأكد من إلغاء هذا الحجز؟ سيتم إعادة الوحدة إلى حالة متاحة."
        confirmLabel="تأكيد الإلغاء"
        confirmVariant="danger"
        action={cancelReservationAction.bind(null, reservationId)}
      />
    </>
  );
}
