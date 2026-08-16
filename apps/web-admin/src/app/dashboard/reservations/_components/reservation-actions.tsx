'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, X, Ban } from 'lucide-react';
import type { Reservation } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { uiT } from '@/messages/ui';
import { StatusDialog } from './status-dialog';
import {
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction,
} from '../actions';

interface Props {
  reservation: Reservation;
  locale?: Locale;
}

export function ReservationActions({ reservation, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approvePending, startApprove] = useTransition();

  const isPending = reservation.status === 'PENDING';
  const isApproved = reservation.status === 'APPROVED';
  const canCancel = isPending || isApproved;

  function handleApprove() {
    if (!window.confirm(m.actionApproveConfirm)) return;
    startApprove(async () => {
      await approveReservationAction(reservation.id);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {/* View */}
      <Link href={`/dashboard/reservations/${reservation.id}`}>
        <IconButton label={m.listViewLabel} variant="outline" size="sm">
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
                label={m.listApproveLabel}
                variant="ghost"
                size="sm"
                disabled={approvePending}
                onClick={handleApprove}
                className="text-success-600 hover:bg-success-50 disabled:opacity-40"
              >
                <CheckCircle2 />
              </IconButton>
              <IconButton
                label={m.listRejectLabel}
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
            {m.listCancelLabel}
          </button>
        </>
      )}

      <StatusDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={m.rejectDialogTitle}
        description={m.rejectDialogDesc}
        confirmLabel={m.rejectConfirmLabel}
        confirmVariant="danger"
        action={rejectReservationAction.bind(null, reservation.id)}
      />

      <StatusDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={m.cancelDialogTitle}
        description={
          isApproved
            ? m.cancelDialogDescApproved
            : m.cancelDialogDescPending
        }
        confirmLabel={m.cancelConfirmLabel}
        confirmVariant="danger"
        reasonRequired
        action={cancelReservationAction.bind(null, reservation.id)}
      />
    </div>
  );
}
