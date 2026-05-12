'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface ReservationFormState {
  error?: string;
}

export async function createReservationAction(
  _prev: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const unitId = String(formData.get('unitId') ?? '').trim();
  const ownerType = String(formData.get('ownerType') ?? '').trim();
  const rawLeadId = String(formData.get('leadId') ?? '').trim() || undefined;
  const rawClientId = String(formData.get('clientId') ?? '').trim() || undefined;
  const salesId = String(formData.get('salesId') ?? '').trim() || undefined;
  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const expiresInHours = Number(formData.get('expiresInHours') ?? 72) || 72;

  const leadId = ownerType === 'lead' ? rawLeadId : undefined;
  const clientId = ownerType === 'client' ? rawClientId : undefined;

  if (!unitId) return { error: 'الوحدة مطلوبة' };
  if (leadId && clientId) {
    return {
      error: 'يجب اختيار عميل محتمل أو عميل مسجل، وليس الاثنين معًا',
    };
  }
  if (!leadId && !clientId) {
    return {
      error: 'يجب اختيار عميل محتمل أو عميل مسجل قبل إنشاء الحجز',
    };
  }

  let createdId: string | null = null;
  try {
    const res = await api.post<{ id: string }>('/reservations', {
      unitId,
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
      salesId,
      notes,
      expiresInHours,
    });
    createdId = res.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
    return { error: msg };
  }

  revalidatePath('/dashboard/reservations');
  redirect(`/dashboard/reservations/${createdId}`);
}

export async function approveReservationAction(id: string) {
  await api.patch(`/reservations/${id}/status`, { status: 'APPROVED' });
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
}

export async function rejectReservationAction(id: string, formData: FormData) {
  const reason = String(formData.get('reason') ?? '').trim() || undefined;
  await api.patch(`/reservations/${id}/status`, { status: 'REJECTED', reason });
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
}

export async function cancelReservationAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) {
    return { error: 'سبب الإلغاء مطلوب' };
  }
  try {
    await api.patch(`/reservations/${id}/status`, { status: 'CANCELLED', reason });
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
  return {};
}

export async function updateReservationAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const salesId = String(formData.get('salesId') ?? '').trim() || undefined;
  const notes = String(formData.get('notes') ?? '');
  const hasNotes = formData.has('notes');
  const expiresInHoursRaw = String(formData.get('expiresInHours') ?? '').trim();
  const expiresInHours = expiresInHoursRaw ? Number(expiresInHoursRaw) : undefined;

  const payload: Record<string, unknown> = {};
  if (salesId) payload.salesId = salesId;
  if (expiresInHours && Number.isFinite(expiresInHours)) payload.expiresInHours = expiresInHours;
  if (hasNotes) payload.notes = notes;

  if (Object.keys(payload).length === 0) {
    return { error: 'لا يوجد تعديل لحفظه' };
  }

  try {
    await api.patch(`/reservations/${id}`, payload);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
  return {};
}

export async function addReservationNoteAction(id: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await api.post(`/reservations/${id}/notes`, { body });
  revalidatePath(`/dashboard/reservations/${id}`);
}
