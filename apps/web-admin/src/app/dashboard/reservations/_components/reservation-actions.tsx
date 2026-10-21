'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, CheckCircle2, X, Ban } from 'lucide-react';
import type { Reservation } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { RowMenu, MenuItem, PrimaryAction } from '@/components/premium/row-menu';
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
      {/* Approve is the row's one main action; reject and cancel sit in the menu. */}
      {isPending && canDecide && (
        <PrimaryAction icon={<CheckCircle2 />} onClick={handleApprove} disabled={approvePending}>
          {m.listApproveShort}
        </PrimaryAction>
      )}

      {canCancel && (
        <RowMenu label={m.listMoreLabel}>
          {isPending && canDecide && (
            <MenuItem icon={<X />} tone="danger" onClick={() => setRejectOpen(true)}>
              {m.listRejectLabel}
            </MenuItem>
          )}
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
