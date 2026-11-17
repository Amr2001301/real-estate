'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, X, Ban } from 'lucide-react';
import type { Reservation } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { RowMenu, MenuItem } from '@/components/premium/row-menu';
import { uiT } from '@/messages/ui';
import { StatusDialog } from './status-dialog';
import {
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction,
} from '../actions';

interface Props {
  reservation: Reservation;
  /** Approve / reject: the admin, or the rep's manager (not on their own). */
  canDecide?: boolean;
  locale?: Locale;
}

export function ReservationActions({ reservation, canDecide = false, locale = 'ar' }: Props) {
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
    <div className="flex items-center justify-end gap-2">
      {/* Approve / reject as round buttons; cancel sits in the menu. */}
      {isPending && canDecide && (
        <>
          <button
            type="button"
            onClick={handleApprove}
            disabled={approvePending}
            aria-label={m.listApproveShort}
            title={m.listApproveShort}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            aria-label={m.listRejectLabel}
            title={m.listRejectLabel}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-rose-500/12 text-rose-700 transition-colors hover:bg-rose-500/20"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}

      {canCancel && (
        <RowMenu label={m.listMoreLabel}>
          <MenuItem icon={<Ban />} onClick={() => setCancelOpen(true)}>
            {m.listCancelLabel}
          </MenuItem>
        </RowMenu>
      )}

      <Link
        href={`/dashboard/reservations/${reservation.id}` as never}
        aria-label={m.listViewLabel}
        title={m.listViewLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
      >
        <Eye className="h-4 w-4" />
      </Link>

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
