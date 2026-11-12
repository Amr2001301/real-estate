'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import type { PlanPreview, PlanScopeInfo } from '@/lib/types';

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
  // (a cash plan has neither — F11).
  const hasDurations = Array.isArray(payload.durationOptions) && payload.durationOptions.length > 0;
  const hasLegacy = typeof payload.installmentsCount === 'number' && payload.installmentsCount > 0;
  if (!payload.isCash && !hasDurations && !hasLegacy) {
    return { error: 'أضف خيار مدة واحد على الأقل أو حدد عدد الأقساط (للنمط القديم)' };
  }

  let createdId: string;
  try {
    const res = await api.post<{ id: string }>('/installment-plan-templates', payload);
    createdId = res.id;
  } catch (e: unknown) {
    unstable_rethrow(e);
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
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }

  revalidateAll(id);
  redirect(`/dashboard/installments/${id}`);
}

export async function deletePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.delete(`/installment-plan-templates/${id}`);
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll();
  return {};
}

export async function activatePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.post(`/installment-plan-templates/${id}/activate`, {});
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll(id);
  return {};
}

export async function deactivatePlanAction(id: string): Promise<{ error?: string }> {
  try {
    await api.post(`/installment-plan-templates/${id}/deactivate`, {});
  } catch (e: unknown) {
    unstable_rethrow(e);
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
    } catch (e) {
      unstable_rethrow(e);
      // ignore malformed input — treat as empty
    }
  }

  // Cash plan (F11): no down payment, durations, instalments or start rule of
  // its own — the API sets the one payment due at signing.
  const isCash = formData.get('isCash') === 'true';
  if (isCash) {
    return {
      isCash: true,
      name: str('name'),
      description: str('description'),
      projectId: str('projectId'),
      unitId: str('unitId') || null,
      totalPrice: num('totalPrice'),
      discountType: str('discountType'),
      discountValue: num('discountValue'),
      reservationAmountType: str('reservationAmountType'),
      reservationAmountValue: num('reservationAmountValue'),
      startDateRule: 'AFTER_CONTRACT',
      status: str('status'),
      visibility: str('visibility') || undefined,
    };
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
    visibility: str('visibility') || undefined,
    durationOptions,
  };
}

export interface VisibilityState {
  updated?: number;
  error?: string;
}

/** Who sees several plans at once — the plan list's bulk bar. */
export async function setPlansVisibilityAction(
  _prev: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  const visibility = String(formData.get('visibility') ?? '');
  if (ids.length === 0) return { error: 'none' };
  if (visibility !== 'PUBLIC' && visibility !== 'SALES_ONLY') return { error: 'حدث خطأ غير متوقع' };
  try {
    const res = await api.post<{ updated: number }>('/installment-plan-templates/visibility', { ids, visibility });
    revalidateAll();
    return { updated: res.updated };
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
}

// ─── Project / unit-type plans (F-019) ──────────────────────────────────────

function projectPlanPayload(formData: FormData): Record<string, unknown> {
  const str = (k: string) => String(formData.get(k) ?? '').trim();
  const num = (k: string) => {
    const v = str(k);
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  let durationOptions: { durationMonths: number; increasePercentage: number }[] = [];
  try {
    const parsed = JSON.parse(str('durationOptions') || '[]');
    if (Array.isArray(parsed)) {
      durationOptions = parsed
        .map((o) => ({ durationMonths: Number(o?.durationMonths), increasePercentage: Number(o?.increasePercentage) }))
        .filter((o) => Number.isFinite(o.durationMonths) && o.durationMonths > 0 && Number.isFinite(o.increasePercentage) && o.increasePercentage >= 0);
    }
  } catch {
    /* treated as empty */
  }
  let unitTypes: string[] = [];
  try {
    const parsed = JSON.parse(str('unitTypes') || '[]');
    if (Array.isArray(parsed)) unitTypes = parsed.map(String).filter(Boolean);
  } catch {
    /* treated as empty */
  }
  const isCash = str('isCash') === 'true';
  const date = (k: string) => str(k) || null;
  return {
    name: str('name'),
    description: str('description') || undefined,
    projectId: str('projectId'),
    unitTypes,
    validFrom: date('validFrom'),
    validTo: date('validTo'),
    isCash,
    discountType: 'PERCENTAGE',
    discountValue: num('discountValue') ?? 0,
    reservationAmountType: str('reservationAmountType') === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
    reservationAmountValue: num('reservationAmountValue') ?? 0,
    ...(isCash
      ? { startDateRule: 'AFTER_CONTRACT' }
      : {
          downPaymentType: 'PERCENTAGE',
          downPaymentValue: num('downPaymentValue') ?? 0,
          startDateRule: str('startDateRule') || 'AFTER_RESERVATION',
          manualStartDate: date('manualStartDate'),
          durationOptions,
          // Balloon plan: both or neither (null clears them on edit).
          ...(str('paymentShape') === 'BALLOON'
            ? { balloonSharePct: num('balloonSharePct') ?? null, balloonEveryMonths: num('balloonEveryMonths') ?? null }
            : { balloonSharePct: null, balloonEveryMonths: null }),
        }),
    status: str('status') || 'DRAFT',
    visibility: str('visibility') || 'SALES_ONLY',
  };
}

export async function createProjectPlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const payload = projectPlanPayload(formData);
  if (!payload.name) return { error: 'اسم الخطة مطلوب' };
  if (!payload.projectId) return { error: 'المشروع مطلوب' };
  if (!payload.isCash && (payload.durationOptions as unknown[]).length === 0) {
    return { error: 'أضف خيار مدة واحدًا على الأقل' };
  }
  // A create must not carry nulls the DTO would reject.
  if (payload.validFrom === null) delete payload.validFrom;
  if (payload.validTo === null) delete payload.validTo;
  if (payload.manualStartDate === null) delete payload.manualStartDate;
  let id: string;
  try {
    id = (await api.post<{ id: string }>('/installment-plan-templates', payload)).id;
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll();
  redirect(`/dashboard/installments/${id}`);
}

export async function updateProjectPlanAction(id: string, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  let payload = projectPlanPayload(formData);
  if (!payload.name) return { error: 'اسم الخطة مطلوب' };
  // Open reservations freeze the terms: send only what may still change.
  if (String(formData.get('termsLocked') ?? '') === 'true') {
    const { name, description, status, visibility, unitTypes, validFrom, validTo } = payload;
    payload = { name, description, status, visibility, unitTypes, validFrom, validTo };
  }
  try {
    await api.patch(`/installment-plan-templates/${id}`, payload);
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
  revalidateAll(id);
  redirect(`/dashboard/installments/${id}`);
}

/** Unit types of a project with their unit counts (the scope picker). */
export async function getScopeInfoAction(projectId: string): Promise<PlanScopeInfo | null> {
  if (!projectId) return null;
  try {
    return await api.get<PlanScopeInfo>(`/installment-plan-templates/scope-info?projectId=${encodeURIComponent(projectId)}`);
  } catch (e: unknown) {
    unstable_rethrow(e);
    return null;
  }
}

/** The plan's numbers on real units of the project, without saving. */
export async function previewProjectPlanAction(body: Record<string, unknown>): Promise<PlanPreview | { error: string }> {
  try {
    return await api.post<PlanPreview>('/installment-plan-templates/preview', body);
  } catch (e: unknown) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message : 'حدث خطأ غير متوقع' };
  }
}
