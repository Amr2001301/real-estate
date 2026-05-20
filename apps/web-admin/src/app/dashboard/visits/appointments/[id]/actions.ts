'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function updateAppointmentStatusAction(appointmentId: string, formData: FormData) {
  const status = String(formData.get('status'));
  const salesNotes = formData.get('salesNotes') as string | null;
  const resultNotes = formData.get('resultNotes') as string | null;
  const cancellationReason = formData.get('cancellationReason') as string | null;
  const noShowReason = formData.get('noShowReason') as string | null;

  // Routes to the new per-transition POST endpoints; the legacy PATCH
  // multiplexer is removed. JSX/UI is unchanged — only the action body URLs.
  if (status === 'CONFIRMED') {
    await api.post(`/visits/appointments/${appointmentId}/confirm`, {
      salesNotes: salesNotes || undefined,
    });
  } else if (status === 'COMPLETED') {
    await api.post(`/visits/appointments/${appointmentId}/complete`, {
      salesNotes: salesNotes || undefined,
      resultNotes: resultNotes || undefined,
    });
  } else if (status === 'CANCELLED') {
    await api.post(`/visits/appointments/${appointmentId}/cancel`, {
      salesNotes: salesNotes || undefined,
      cancellationReason: cancellationReason || undefined,
    });
  } else if (status === 'NO_SHOW') {
    await api.post(`/visits/appointments/${appointmentId}/no-show`, {
      salesNotes: salesNotes || undefined,
      noShowReason: noShowReason || undefined,
    });
  } else {
    throw new Error(`Unsupported appointment status transition: ${status}`);
  }

  revalidatePath('/dashboard/visits');
  revalidatePath(`/dashboard/visits/appointments/${appointmentId}`);
}

export async function rescheduleVisitAction(appointmentId: string, formData: FormData) {
  const scheduledAt = String(formData.get('scheduledAt'));
  const assignedSalesId = formData.get('assignedSalesId') as string | null;
  const location = formData.get('location') as string | null;
  const meetingPoint = formData.get('meetingPoint') as string | null;
  const salesNotes = formData.get('salesNotes') as string | null;

  await api.post(`/visits/appointments/${appointmentId}/reschedule`, {
    scheduledAt,
    assignedSalesId: assignedSalesId || undefined,
    location: location || undefined,
    meetingPoint: meetingPoint || undefined,
    salesNotes: salesNotes || undefined,
  });
  revalidatePath('/dashboard/visits');
  revalidatePath(`/dashboard/visits/appointments/${appointmentId}`);
}

export async function assignSalesAction(appointmentId: string, formData: FormData) {
  const assignedSalesId = String(formData.get('assignedSalesId'));
  await api.patch(`/visits/appointments/${appointmentId}/assign`, { assignedSalesId });
  revalidatePath('/dashboard/visits');
  revalidatePath(`/dashboard/visits/appointments/${appointmentId}`);
}
