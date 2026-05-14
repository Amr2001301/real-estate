'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface PlanFormState {
  error?: string;
}

function revalidateAll(id?: string) {
  revalidatePath('/dashboard/installments');
  if (id) revalidatePath(`/dashboard/installments/${id}`);
}

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const projectId = String(formData.get('projectId') ?? '').trim();
  const totalPrice = Number(formData.get('totalPrice'));
  const installmentsCount = Number(formData.get('installmentsCount'));

  if (!name) return { error: 'اسم الخطة مطلوب' };
  if (!projectId) return { error: 'المشروع مطلوب' };
  if (!totalPrice || totalPrice <= 0) return { error: 'السعر الإجمالي يجب أن يكون أكبر من صفر' };
  if (!installmentsCount || installmentsCount < 1) return { error: 'عدد الأقساط يجب أن يكون أكبر من صفر' };

  const payload = buildPayload(formData);

  let createdId: string;
  try {
    const res = await api.post<{ id: string }>('/installment-plan-templates', payload);
    createdId = res.id;
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }

  revalidateAll();
  redirect(`/dashboard/installments/${createdId}`);
}

export async function updatePlanAction(
  id: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'اسم الخطة مطلوب' };

  const payload = buildPayload(formData);

  try {
    await api.patch(`/installment-plan-templates/${id}`, payload);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }

  revalidateAll(id);
  redirect(`/dashboard/installments/${id}`);
}

export async function deletePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.delete(`/installment-plan-templates/${id}`);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll();
  return {};
}

export async function activatePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.post(`/installment-plan-templates/${id}/activate`, {});
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll(id);
  return {};
}

export async function deactivatePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.post(`/installment-plan-templates/${id}/deactivate`, {});
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll(id);
  return {};
}

function buildPayload(formData: FormData): Record<string, unknown> {
  const str = (key: string) => String(formData.get(key) ?? '').trim() || undefined;
  const num = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    name: str('name'),
    description: str('description'),
    projectId: str('projectId'),
    unitId: str('unitId') || null,
    totalPrice: num('totalPrice'),
    discountAmount: num('discountAmount') ?? 0,
    reservationAmount: num('reservationAmount') ?? 0,
    downPaymentType: str('downPaymentType'),
    downPaymentValue: num('downPaymentValue'),
    installmentsCount: num('installmentsCount'),
    frequency: str('frequency'),
    startDateRule: str('startDateRule'),
    manualStartDate: str('manualStartDate') || null,
    finalPaymentAmount: num('finalPaymentAmount') || null,
    status: str('status'),
  };
}
