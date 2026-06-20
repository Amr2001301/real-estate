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
    <div className="flex items-center gap-1">
      {/* View */}
      <Link href={`/dashboard/reservations/${reservation.id}`}>
        <IconButton label="عرض تفاصيل الحجز" variant="outline" size="sm">
          <Eye />
        </IconButton>
      </Link>

      {canCancel && (
        <>
          <span className="w-px h-4 bg-hairline shrink-0 mx-0.5" aria-hidden />

          {/* Approve + Reject as icon-only buttons to keep PENDING rows compact */}
          {isPending && (
            <>
              <IconButton
                label="موافقة على الحجز"
                variant="ghost"
                size="sm"
                disabled={approvePending}
                onClick={handleApprove}
                className="text-success-600 hover:bg-success-50 disabled:opacity-40"
              >
                <CheckCircle2 />
              </IconButton>
              <IconButton
                label="رفض الحجز"
                variant="ghost"
                size="sm"
                onClick={() => setRejectOpen(true)}
                className="text-danger-500 hover:bg-danger-50"
              >
                <X />
              </IconButton>
              <span className="w-px h-4 bg-hairline shrink-0 mx-0.5" aria-hidden />
            </>
          )}

          {/* Cancel — subtle danger text button, always stays on same row */}
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors duration-100 whitespace-nowrap shrink-0"
          >
            <Ban className="h-3 w-3 shrink-0" />
            إلغاء
          </button>
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
