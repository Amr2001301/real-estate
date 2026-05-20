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

  // Plan linkage + optional booking notes are the only booking-related fields
  // accepted on create. bookingAmount is derived server-side from the plan,
  // and bookingPaymentStatus always starts as UNPAID (confirmed later via the
  // dedicated booking-payment endpoints).
  const installmentPlanTemplateId =
    String(formData.get('installmentPlanTemplateId') ?? '').trim() || undefined;
  const installmentPlanDurationOptionId =
    String(formData.get('installmentPlanDurationOptionId') ?? '').trim() || undefined;
  const bookingNotes =
    String(formData.get('bookingNotes') ?? '').trim() || undefined;

  let createdId: string | null = null;
  try {
    const res = await api.post<{ id: string }>('/reservations', {
      unitId,
      ...(leadId ? { leadId } : {}),
      ...(clientId ? { clientId } : {}),
      salesId,
      notes,
      expiresInHours,
      ...(installmentPlanTemplateId ? { installmentPlanTemplateId } : {}),
      ...(installmentPlanDurationOptionId
        ? { installmentPlanDurationOptionId }
        : {}),
      ...(bookingNotes ? { bookingNotes } : {}),
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
  // Each status transition now has a dedicated strict-permission endpoint.
  // The legacy PATCH /reservations/:id/status route has been removed.
  await api.post(`/reservations/${id}/approve`, {});
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
}

export async function rejectReservationAction(id: string, formData: FormData) {
  const reason = String(formData.get('reason') ?? '').trim() || undefined;
  await api.post(`/reservations/${id}/reject`, { reason });
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
    await api.post(`/reservations/${id}/cancel`, { reason });
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

export async function convertReservationAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string; contractId?: string }> {
  // The API no longer accepts `signedAt` on /reservations/:id/convert —
  // signing is a separate strict action via POST /contracts/:id/sign.
  // The convert UI still exposes the optional signedAt field; we split
  // the flow here.
  const startsAt = String(formData.get('startsAt') ?? '').trim() || undefined;
  const signedAt = String(formData.get('signedAt') ?? '').trim() || undefined;
  const pdfUrl = String(formData.get('pdfUrl') ?? '').trim() || undefined;

  let result: { contractId: string; contractNumber: string };
  try {
    result = await api.post<{ contractId: string; contractNumber: string }>(
      `/reservations/${id}/convert`,
      { startsAt, pdfUrl },
    );
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }

  // Optional signing step — naturally requires the strict `contracts:sign`
  // permission. If signing fails, the contract was still created; surface
  // the error so the user can sign manually from the contract detail page
  // rather than re-submitting the convert form (which would duplicate).
  if (signedAt) {
    try {
      await api.post(`/contracts/${result.contractId}/sign`, { signedAt });
    } catch (e: unknown) {
      revalidatePath('/dashboard/reservations');
      revalidatePath(`/dashboard/reservations/${id}`);
      revalidatePath('/dashboard/contracts');
      const reason = e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
      return {
        contractId: result.contractId,
        error: `تم تحويل الحجز إلى عقد لكن فشل التوقيع: ${reason}. افتح صفحة العقد وحاول التوقيع مرة أخرى.`,
      };
    }
  }

  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
  revalidatePath('/dashboard/contracts');
  return { contractId: result.contractId };
}

export async function addReservationNoteAction(id: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await api.post(`/reservations/${id}/notes`, { body });
  revalidatePath(`/dashboard/reservations/${id}`);
}

export async function confirmBookingPaymentAction(
  id: string,
  formData?: FormData,
): Promise<{ error?: string }> {
  const paidAtRaw = String(formData?.get('paidAt') ?? '').trim();
  const note = String(formData?.get('note') ?? '').trim() || undefined;
  const payload: Record<string, unknown> = {};
  if (paidAtRaw) payload.paidAt = new Date(paidAtRaw).toISOString();
  if (note) payload.note = note;
  try {
    await api.post(`/reservations/${id}/booking-payment/confirm`, payload);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
  revalidatePath('/dashboard/deposits');
  return {};
}

export async function unconfirmBookingPaymentAction(
  id: string,
  formData?: FormData,
): Promise<{ error?: string }> {
  const newStatus = String(formData?.get('newStatus') ?? '').trim() || undefined;
  const note = String(formData?.get('note') ?? '').trim() || undefined;
  const payload: Record<string, unknown> = {};
  if (newStatus) payload.newStatus = newStatus;
  if (note) payload.note = note;
  try {
    await api.post(`/reservations/${id}/booking-payment/unconfirm`, payload);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidatePath('/dashboard/reservations');
  revalidatePath(`/dashboard/reservations/${id}`);
  revalidatePath('/dashboard/deposits');
  return {};
}

export async function updateReservationBookingAction(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const payload: Record<string, unknown> = {};

  if (formData.has('installmentPlanTemplateId')) {
    const v = String(formData.get('installmentPlanTemplateId') ?? '').trim();
    payload.installmentPlanTemplateId = v || null;
  }
  if (formData.has('bookingAmount')) {
    const raw = String(formData.get('bookingAmount') ?? '').trim();
    if (raw === '') {
      payload.bookingAmount = 0;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { error: 'مبلغ الحجز يجب أن يكون رقماً موجباً' };
      }
      payload.bookingAmount = n;
    }
  }
  if (formData.has('bookingPaymentStatus')) {
    const v = String(formData.get('bookingPaymentStatus') ?? '').trim();
    if (v) payload.bookingPaymentStatus = v;
  }
  if (formData.has('bookingPaidAt')) {
    const v = String(formData.get('bookingPaidAt') ?? '').trim();
    payload.bookingPaidAt = v ? new Date(v).toISOString() : null;
  }
  if (formData.has('bookingNotes')) {
    payload.bookingNotes = String(formData.get('bookingNotes') ?? '');
  }

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
