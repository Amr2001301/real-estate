'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export interface VisitFormState {
  error?: string;
}

export async function createVisitAction(
  _prev: VisitFormState,
  formData: FormData,
): Promise<VisitFormState> {
  const ownerType = String(formData.get('ownerType') ?? '').trim();
  const rawLeadId = String(formData.get('leadId') ?? '').trim() || undefined;
  const rawClientId = String(formData.get('clientId') ?? '').trim() || undefined;
  const projectId = String(formData.get('projectId') ?? '').trim();
  const unitId = String(formData.get('unitId') ?? '').trim() || undefined;
  const assignedSalesId = String(formData.get('assignedSalesId') ?? '').trim() || undefined;
  const scheduledAt = String(formData.get('scheduledAt') ?? '').trim();
  const durationRaw = String(formData.get('durationMinutes') ?? '').trim();
  const durationMinutes = durationRaw ? Number(durationRaw) : undefined;
  const location = String(formData.get('location') ?? '').trim() || undefined;
  const meetingPoint = String(formData.get('meetingPoint') ?? '').trim() || undefined;
  const salesNotes = String(formData.get('salesNotes') ?? '').trim() || undefined;
  const customerName = String(formData.get('customerName') ?? '').trim() || undefined;
  const customerPhone = String(formData.get('customerPhone') ?? '').trim() || undefined;
  const status = String(formData.get('status') ?? '').trim() || undefined;

  const leadId = ownerType === 'lead' ? rawLeadId : undefined;
  const clientId = ownerType === 'client' ? rawClientId : undefined;

  if (!projectId) return { error: 'يجب اختيار المشروع' };
  if (!scheduledAt) return { error: 'يجب تحديد تاريخ ووقت الزيارة' };

  if (ownerType === 'lead' && !leadId) return { error: 'يجب اختيار العميل المحتمل' };
  if (ownerType === 'client' && !clientId) return { error: 'يجب اختيار العميل المسجل' };
  if (ownerType === 'walkin' && (!customerName || !customerPhone)) {
    return { error: 'يجب إدخال اسم العميل ورقم الهاتف للزيارة بدون حساب' };
  }

  let createdId: string | null = null;
  try {
    const res = await api.post<{ id: string }>('/visits/appointments', {
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
      projectId,
      unitId,
      assignedSalesId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
      location,
      meetingPoint,
      salesNotes,
      customerName,
      customerPhone,
      ...(status ? { status } : {}),
    });
    createdId = res.id;
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }

  revalidatePath('/dashboard/visits');
  redirect(`/dashboard/visits/appointments/${createdId}`);
}

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

  // The legacy PATCH /visits/appointments/:id/status multiplexer has been
  // removed. Each transition routes to its own POST endpoint, each gated by
  // a dedicated permission code (visits:confirm / :complete / :cancel /
  // :no-show). The UI keeps submitting the same `status` field; we dispatch
  // here without any visible change.
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
