'use client';

import { useState } from 'react';
import { CheckCircle, RefreshCw, UserCheck, X, UserX } from 'lucide-react';
import type { VisitAppointment, AppointmentStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RescheduleModal } from '../../../_components/reschedule-modal';
import { AssignSalesModal } from '../../../_components/assign-sales-modal';
import { updateAppointmentStatusAction } from '../actions';

const FINAL: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];

interface Props {
  appointment: VisitAppointment;
  salesOptions: { id: string; fullName: string }[];
}

export function AppointmentDetailActions({ appointment, salesOptions }: Props) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const isFinal = FINAL.includes(appointment.status);
  if (isFinal) return null;

  return (
    <>
      {appointment.status === 'SCHEDULED' && (
        <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
          <input type="hidden" name="status" value="CONFIRMED" />
          <Button type="submit" variant="subtle" size="md" leftIcon={<CheckCircle className="h-4 w-4" />}>
            تأكيد الزيارة
          </Button>
        </form>
      )}

      {(appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED') && (
        <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
          <input type="hidden" name="status" value="COMPLETED" />
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="bg-success-600 hover:bg-success-700"
          >
            تمت الزيارة
          </Button>
        </form>
      )}

      <Button
        variant="outline"
        size="md"
        leftIcon={<RefreshCw className="h-4 w-4" />}
        onClick={() => setRescheduleOpen(true)}
      >
        إعادة جدولة
      </Button>

      <Button
        variant="outline"
        size="md"
        leftIcon={<UserCheck className="h-4 w-4" />}
        onClick={() => setAssignOpen(true)}
      >
        تغيير المندوب
      </Button>

      <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
        <input type="hidden" name="status" value="NO_SHOW" />
        <Button
          type="submit"
          variant="outline"
          size="md"
          leftIcon={<UserX className="h-4 w-4" />}
          className="text-amber-600 border-amber-200 hover:bg-amber-50"
        >
          لم يحضر
        </Button>
      </form>

      <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="contents">
        <input type="hidden" name="status" value="CANCELLED" />
        <Button
          type="submit"
          variant="outline"
          size="md"
          leftIcon={<X className="h-4 w-4" />}
          className="text-danger-600 border-danger-200 hover:bg-danger-50"
        >
          إلغاء
        </Button>
      </form>

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
    </>
  );
}
