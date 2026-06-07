'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, RefreshCw, UserCheck, CheckCircle, X, UserX } from 'lucide-react';
import type { VisitAppointment, AppointmentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { RescheduleModal } from './reschedule-modal';
import { AssignSalesModal } from './assign-sales-modal';
import { updateAppointmentStatusAction } from '../actions';

const FINAL: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];

interface Props {
  appointment: VisitAppointment;
  salesOptions: { id: string; fullName: string }[];
}

export function AppointmentActions({ appointment, salesOptions }: Props) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const isFinal = FINAL.includes(appointment.status);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Link href={`/dashboard/visits/appointments/${appointment.id}` as never}>
        <IconButton label="عرض تفاصيل الزيارة" variant="outline" size="sm">
          <Eye />
        </IconButton>
      </Link>

      {!isFinal && (
        <>
          <span className="w-px h-4 bg-hairline shrink-0" aria-hidden />

          {/* "تأكيد" — admin-side confirm. Available only for SCHEDULED rows,
              and only useful to acknowledge a customer who can't use the
              portal; the new workflow expects the customer to confirm
              themselves via /me/visit-appointments/:id/confirm. */}
          {appointment.status === 'SCHEDULED' && (
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
              <input type="hidden" name="status" value="CONFIRMED" />
              <Button type="submit" variant="subtle" size="sm" leftIcon={<CheckCircle className="h-3.5 w-3.5" />}>
                تأكيد
              </Button>
            </form>
          )}

          {/* "تمت" (Complete) — backend guard now requires CONFIRMED. Hiding
              the button on SCHEDULED / PENDING_RESCHEDULE keeps the UI in
              lockstep with the server-side rule (no surprise 400). */}
          {appointment.status === 'CONFIRMED' && (
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
              <input type="hidden" name="status" value="COMPLETED" />
              <Button type="submit" variant="ghost" size="sm" className="text-success-700 hover:bg-success-50">
                تمت
              </Button>
            </form>
          )}

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => setRescheduleOpen(true)}
          >
            إعادة جدولة
          </Button>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<UserCheck className="h-3.5 w-3.5" />}
            onClick={() => setAssignOpen(true)}
          >
            المندوب
          </Button>

          {/* "لم يحضر" — backend guard rejects no-show before scheduledAt.
              Hide the button until the visit time has actually passed. */}
          {new Date(appointment.scheduledAt).getTime() <= Date.now() && (
            <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
              <input type="hidden" name="status" value="NO_SHOW" />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                leftIcon={<UserX className="h-3.5 w-3.5" />}
                className="text-amber-600 hover:bg-amber-50"
              >
                لم يحضر
              </Button>
            </form>
          )}

          <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
            <input type="hidden" name="status" value="CANCELLED" />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-3.5 w-3.5" />}
              className="text-danger-600 hover:bg-danger-50"
            >
              إلغاء
            </Button>
          </form>
        </>
      )}

      <RescheduleModal
        appointmentId={appointment.id}
        salesOptions={salesOptions}
        currentSalesId={appointment.assignedSalesId}
        currentScheduledAt={appointment.scheduledAt}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
      />

      <AssignSalesModal
        appointmentId={appointment.id}
        salesOptions={salesOptions}
        currentSalesId={appointment.assignedSalesId}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />
    </div>
  );
}
