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

  if (!name) return { error: 'اسم الخطة مطلوب' };
  if (!projectId) return { error: 'المشروع مطلوب' };
  if (!totalPrice || totalPrice <= 0) return { error: 'السعر الإجمالي يجب أن يكون أكبر من صفر' };

  const payload = buildPayload(formData);

  // Validate: must have either duration options or legacy installmentsCount
  const hasDurations = Array.isArray(payload.durationOptions) && payload.durationOptions.length > 0;
  const hasLegacy = typeof payload.installmentsCount === 'number' && payload.installmentsCount > 0;
  if (!hasDurations && !hasLegacy) {
    return { error: 'أضف خيار مدة واحد على الأقل أو حدد عدد الأقساط (للنمط القديم)' };
  }

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

  // Duration options come from the form as a JSON-encoded array (hidden input)
  const rawDurationOptions = String(formData.get('durationOptions') ?? '').trim();
  let durationOptions: { durationMonths: number; increasePercentage: number }[] = [];
  if (rawDurationOptions) {
    try {
      const parsed = JSON.parse(rawDurationOptions);
      if (Array.isArray(parsed)) {
        durationOptions = parsed
          .map((o: unknown) => {
            if (typeof o !== 'object' || o === null) return null;
            const r = o as Record<string, unknown>;
            const months = Number(r.durationMonths);
            const pct = Number(r.increasePercentage);
            if (!Number.isFinite(months) || months <= 0) return null;
            if (!Number.isFinite(pct) || pct < 0) return null;
            return { durationMonths: months, increasePercentage: pct };
          })
          .filter((x): x is { durationMonths: number; increasePercentage: number } => x !== null);
      }
    } catch {
      // ignore malformed input — treat as empty
    }
  }

  return {
    name: str('name'),
    description: str('description'),
    projectId: str('projectId'),
    unitId: str('unitId') || null,
    totalPrice: num('totalPrice'),
    // Discount: type + value (mirrors down payment). The API computes the
    // concrete discountAmount from these.
    discountType: str('discountType'),
    discountValue: num('discountValue'),
    // Booking amount: type + value (mirrors down payment). The API computes the
    // concrete reservationAmount from these.
    reservationAmountType: str('reservationAmountType'),
    reservationAmountValue: num('reservationAmountValue'),
    downPaymentType: str('downPaymentType'),
    downPaymentValue: num('downPaymentValue'),
    installmentsCount: num('installmentsCount'),
    frequency: str('frequency'),
    startDateRule: str('startDateRule'),
    manualStartDate: str('manualStartDate') || null,
    finalPaymentAmount: num('finalPaymentAmount') || null,
    status: str('status'),
    durationOptions,
  };
}
