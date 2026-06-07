'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, X, Ban } from 'lucide-react';
import type { Reservation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { StatusDialog } from './status-dialog';
import {
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction,
} from '../actions';

interface Props {
  reservation: Reservation;
}

export function ReservationActions({ reservation }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approvePending, startApprove] = useTransition();

  const isPending = reservation.status === 'PENDING';
  const isApproved = reservation.status === 'APPROVED';
  const canCancel = isPending || isApproved;

  function handleApprove() {
    if (!window.confirm('هل أنت متأكد من الموافقة على هذا الحجز؟')) return;
    startApprove(async () => {
      await approveReservationAction(reservation.id);
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Link href={`/dashboard/reservations/${reservation.id}`}>
        <IconButton label="عرض تفاصيل الحجز" variant="outline" size="sm">
          <Eye />
        </IconButton>
      </Link>

      {canCancel && (
        <>
          <span className="w-px h-4 bg-hairline shrink-0" aria-hidden />

          {isPending && (
            <>
              <Button
                variant="subtle"
                size="sm"
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                loading={approvePending}
                onClick={handleApprove}
                className="text-success-700 hover:bg-success-50"
              >
                موافقة
              </Button>

              <Button
                variant="ghost"
                size="sm"
                leftIcon={<X className="h-3.5 w-3.5" />}
                onClick={() => setRejectOpen(true)}
                className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
              >
                رفض
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Ban className="h-3.5 w-3.5" />}
            onClick={() => setCancelOpen(true)}
            className="text-slate-500 hover:text-slate-700"
          >
            إلغاء
          </Button>
        </>
      )}

      <StatusDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="رفض الحجز"
        description="هل أنت متأكد من رفض هذا الحجز؟ سيتم إعادة الوحدة إلى حالة متاحة."
        confirmLabel="تأكيد الرفض"
        confirmVariant="danger"
        action={rejectReservationAction.bind(null, reservation.id)}
      />

      <StatusDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="إلغاء الحجز"
        description={
          isApproved
            ? 'سيتم إلغاء هذا الحجز المعتمد قبل التعاقد. يُلزم ذكر السبب للأرشيف.'
            : 'سيتم إلغاء هذا الحجز. يُلزم ذكر السبب للأرشيف.'
        }
        confirmLabel="تأكيد الإلغاء"
        confirmVariant="danger"
        reasonRequired
        action={cancelReservationAction.bind(null, reservation.id)}
      />
    </div>
  );
}
