'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, RefreshCw, UserCheck, CheckCircle, CheckCheck, X, UserX } from 'lucide-react';
import type { VisitAppointment, AppointmentStatus } from '@/lib/types';
import { RescheduleModal } from './reschedule-modal';
import { RowMenu, MenuItem, PrimaryAction } from './row-menu';
import { AssignSalesModal } from './assign-sales-modal';
import { updateAppointmentStatusAction } from '../actions';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

const FINAL: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];

interface Props {
  appointment: VisitAppointment;
  salesOptions: { id: string; fullName: string }[];
  locale?: Locale;
}

export function AppointmentActions({ appointment, salesOptions, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.visitComponents;
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const isFinal = FINAL.includes(appointment.status);

  const canNoShow = new Date(appointment.scheduledAt).getTime() <= Date.now();

  return (
    <div className="flex items-center justify-end gap-2">
      {!isFinal && (
        <>
          {/* Admin-side confirm for SCHEDULED; complete needs CONFIRMED (backend guard). */}
          {appointment.status === 'SCHEDULED' && (
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)}>
              <input type="hidden" name="status" value="CONFIRMED" />
              <PrimaryAction type="submit" icon={<CheckCircle />}>{m.confirmBtn}</PrimaryAction>
            </form>
          )}
          {appointment.status === 'CONFIRMED' && (
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)}>
              <input type="hidden" name="status" value="COMPLETED" />
              <PrimaryAction type="submit" icon={<CheckCheck />} tone="success">{m.completeBtn}</PrimaryAction>
            </form>
          )}

          <RowMenu label={m.moreActions}>
            <MenuItem icon={<RefreshCw />} onClick={() => setRescheduleOpen(true)}>{m.rescheduleBtn}</MenuItem>
            <MenuItem icon={<UserCheck />} onClick={() => setAssignOpen(true)}>{m.changeSalesRepBtn}</MenuItem>
            {/* No-show — backend guard rejects before scheduledAt. */}
            {canNoShow && (
              <form action={updateAppointmentStatusAction.bind(null, appointment.id)}>
                <input type="hidden" name="status" value="NO_SHOW" />
                <MenuItem type="submit" icon={<UserX />} tone="warning">{m.noShowBtn}</MenuItem>
              </form>
            )}
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)}>
              <input type="hidden" name="status" value="CANCELLED" />
              <MenuItem type="submit" icon={<X />} tone="danger">{m.cancelBtn}</MenuItem>
            </form>
          </RowMenu>
        </>
      )}

      <Link
        href={`/dashboard/visits/appointments/${appointment.id}` as never}
        aria-label={m.ariaViewVisit}
        title={m.ariaViewVisit}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900"
      >
        <Eye className="h-4 w-4" />
      </Link>

      <RescheduleModal
        appointmentId={appointment.id}
        salesOptions={salesOptions}
        currentSalesId={appointment.assignedSalesId}
        currentScheduledAt={appointment.scheduledAt}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        locale={locale}
      />

      <AssignSalesModal
        appointmentId={appointment.id}
        salesOptions={salesOptions}
        currentSalesId={appointment.assignedSalesId}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        locale={locale}
      />
    </div>
  );
}
