'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function updateRequestStatusAction(requestId: string, formData: FormData) {
  const status = String(formData.get('status'));
  const adminNotes = formData.get('adminNotes') as string | null;
  await api.patch(`/visits/requests/${requestId}`, { status, adminNotes });
  revalidatePath('/dashboard/visits');
  revalidatePath(`/dashboard/visits/requests/${requestId}`);
}

export async function scheduleVisitAction(requestId: string, formData: FormData) {
  const scheduledAt = String(formData.get('scheduledAt'));
  const assignedSalesId = formData.get('assignedSalesId') as string | null;
  const durationMinutes = formData.get('durationMinutes');
  const location = formData.get('location') as string | null;
  const meetingPoint = formData.get('meetingPoint') as string | null;
  const salesNotes = formData.get('salesNotes') as string | null;

  await api.post(`/visits/requests/${requestId}/schedule`, {
    scheduledAt,
    assignedSalesId: assignedSalesId || undefined,
    durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
    location: location || undefined,
    meetingPoint: meetingPoint || undefined,
    salesNotes: salesNotes || undefined,
  });
  revalidatePath('/dashboard/visits');
  revalidatePath(`/dashboard/visits/requests/${requestId}`);
}

export async function updateAppointmentStatusAction(appointmentId: string, formData: FormData) {
  const status = String(formData.get('status'));
  const salesNotes = formData.get('salesNotes') as string | null;
  const resultNotes = formData.get('resultNotes') as string | null;
  const cancellationReason = formData.get('cancellationReason') as string | null;
  const noShowReason = formData.get('noShowReason') as string | null;

  await api.patch(`/visits/appointments/${appointmentId}/status`, {
    status,
    salesNotes: salesNotes || undefined,
    resultNotes: resultNotes || undefined,
    cancellationReason: cancellationReason || undefined,
    noShowReason: noShowReason || undefined,
  });
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
