'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, X, Ban, Pencil } from 'lucide-react';
import type { ReservationStatus } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { PermissionDeniedState } from '@/components/permission-denied';
import { StatusDialog } from '../../_components/status-dialog';
import { uiT } from '@/messages/ui';
import {
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction,
  type ReservationActionResult,
} from '../../actions';
import { EditReservationDialog } from './edit-dialog';

interface SalesUser {
  id: string;
  fullName: string;
}

interface Props {
  reservationId: string;
  status: ReservationStatus;
  currentSalesId: string;
  currentNotes: string | null;
  salesOptions: SalesUser[];
  /** Approve/reject/cancel are admin/finance actions (strict permissions).
   *  When false (e.g. SALES), only the edit action is offered. */
  canManage?: boolean;
  locale?: Locale;
}

export function ReservationDetailActions({
  reservationId,
  status,
  currentSalesId,
  currentNotes,
  salesOptions,
  canManage = false,
  locale = 'ar',
}: Props) {
  const m = uiT(locale).pages.reservationDetailPage;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [approvePending, startApprove] = useTransition();
  const [approveResult, setApproveResult] = useState<ReservationActionResult | null>(
    null,
  );

  const isPending = status === 'PENDING';
  const isApproved = status === 'APPROVED';

  if (!isPending && !isApproved) return null;

  function handleApprove() {
    if (!window.confirm(m.actionApproveConfirm)) return;
    startApprove(async () => {
      const result = await approveReservationAction(reservationId);
      setApproveResult(result?.error ? result : null);
    });
  }

  const approveDenied = approveResult?.missingPermission === true;

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && isPending && (
          <>
            <Button
              variant="primary"
              size="md"
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              loading={approvePending}
              disabled={approveDenied}
              onClick={handleApprove}
            >
              {m.actionBtnApprove}
            </Button>

            <Button
              variant="outline"
              size="md"
              leftIcon={<X className="h-4 w-4" />}
              onClick={() => setRejectOpen(true)}
              className="text-danger-600 border-danger-200 hover:bg-danger-50"
            >
              {m.actionBtnReject}
            </Button>
          </>
        )}

        {canManage && (
          <Button
            variant="outline"
            size="md"
            leftIcon={<Ban className="h-4 w-4" />}
            onClick={() => setCancelOpen(true)}
          >
            {m.actionBtnCancel}
          </Button>
        )}

        {isPending && (
          <Button
            variant="outline"
            size="md"
            leftIcon={<Pencil className="h-4 w-4" />}
            onClick={() => setEditOpen(true)}
          >
            {m.actionBtnEdit}
          </Button>
        )}
      </div>

      {/* Inline approve feedback — a missing reservations:approve renders here
          instead of crashing the page. */}
      {approveResult?.error && (
        approveDenied ? (
          <div className="w-full sm:max-w-sm">
            <PermissionDeniedState
              variant="inline"
              permissions={approveResult.permissions ?? []}
              title={m.permissionDeniedTitle}
              description={m.permissionDeniedDesc}
            />
          </div>
        ) : (
          <p className="text-xs text-danger-600">{approveResult.error}</p>
        )
      )}

      <StatusDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={m.rejectDialogTitle}
        description={m.rejectDialogDesc}
        confirmLabel={m.rejectConfirmLabel}
        confirmVariant="danger"
        action={rejectReservationAction.bind(null, reservationId)}
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
        action={cancelReservationAction.bind(null, reservationId)}
      />

      {isPending && (
        <EditReservationDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          reservationId={reservationId}
          currentSalesId={currentSalesId}
          currentNotes={currentNotes}
          salesOptions={salesOptions}
          locale={locale}
        />
      )}
    </div>
  );
}
