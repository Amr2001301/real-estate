'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { AdminBrokerPayout, BrokerPayoutMethod } from '@/lib/types';

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export interface BrokerPayoutActionState {
  error?: string;
  ok?: boolean;
}

export async function createBrokerPayoutAction(
  _prev: BrokerPayoutActionState,
  formData: FormData,
): Promise<BrokerPayoutActionState> {
  const brokerId = str(formData, 'brokerId');
  if (!brokerId) return { error: 'يجب اختيار وسيط' };
  const period = str(formData, 'period');
  const notes = str(formData, 'notes');
  const commissionIds = formData.getAll('commissionIds').map(String).filter(Boolean);

  let created: AdminBrokerPayout;
  try {
    created = await api.post<AdminBrokerPayout>('/broker-payouts', {
      brokerId,
      period,
      notes,
      commissionIds: commissionIds.length > 0 ? commissionIds : undefined,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/broker-payouts');
  revalidatePath('/dashboard/broker-commissions');
  redirect(`/dashboard/broker-payouts/${created.id}`);
}

export async function addCommissionsToPayoutAction(
  payoutId: string,
  formData: FormData,
) {
  const commissionIds = formData.getAll('commissionIds').map(String).filter(Boolean);
  if (commissionIds.length === 0) return;
  await api.post(`/broker-payouts/${payoutId}/add-commissions`, { commissionIds });
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  revalidatePath('/dashboard/broker-commissions');
}

export async function removeCommissionFromPayoutAction(
  payoutId: string,
  commissionId: string,
) {
  await api.post(`/broker-payouts/${payoutId}/remove-commissions`, {
    commissionIds: [commissionId],
  });
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  revalidatePath('/dashboard/broker-commissions');
}

export async function approvePayoutAction(
  payoutId: string,
  _prev: BrokerPayoutActionState,
  formData: FormData,
): Promise<BrokerPayoutActionState> {
  const notes = str(formData, 'notes');
  try {
    await api.patch(`/broker-payouts/${payoutId}/approve`, { notes });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  return { ok: true };
}

export async function processPayoutAction(
  payoutId: string,
  _prev: BrokerPayoutActionState,
  formData: FormData,
): Promise<BrokerPayoutActionState> {
  const paymentMethod = str(formData, 'paymentMethod') as BrokerPayoutMethod | undefined;
  const scheduledAt = str(formData, 'scheduledAt');
  const scheduledAtIso = scheduledAt && /^\d{4}-\d{2}-\d{2}$/.test(scheduledAt)
    ? `${scheduledAt}T00:00:00.000Z`
    : scheduledAt;
  const notes = str(formData, 'notes');
  try {
    await api.patch(`/broker-payouts/${payoutId}/process`, {
      paymentMethod,
      scheduledAt: scheduledAtIso,
      notes,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  return { ok: true };
}

export async function markPayoutPaidAction(
  payoutId: string,
  _prev: BrokerPayoutActionState,
  formData: FormData,
): Promise<BrokerPayoutActionState> {
  const paymentMethod = str(formData, 'paymentMethod') as BrokerPayoutMethod | undefined;
  if (!paymentMethod) return { error: 'طريقة الدفع مطلوبة' };
  const paymentReference = str(formData, 'paymentReference');
  const receiptUrl = str(formData, 'receiptUrl');
  const paidAt = str(formData, 'paidAt');
  const paidAtIso = paidAt && /^\d{4}-\d{2}-\d{2}$/.test(paidAt)
    ? `${paidAt}T00:00:00.000Z`
    : paidAt;
  const notes = str(formData, 'notes');
  try {
    await api.patch(`/broker-payouts/${payoutId}/mark-paid`, {
      paymentMethod,
      paymentReference,
      receiptUrl,
      paidAt: paidAtIso,
      notes,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  return { ok: true };
}

export async function cancelPayoutAction(
  payoutId: string,
  _prev: BrokerPayoutActionState,
  formData: FormData,
): Promise<BrokerPayoutActionState> {
  const reason = str(formData, 'reason');
  if (!reason) return { error: 'سبب الإلغاء مطلوب' };
  try {
    await api.patch(`/broker-payouts/${payoutId}/cancel`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-payouts/${payoutId}`);
  revalidatePath('/dashboard/broker-payouts');
  revalidatePath('/dashboard/broker-commissions');
  return { ok: true };
}
