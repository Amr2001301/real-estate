'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export interface BrokerCommissionActionState {
  error?: string;
  ok?: boolean;
}

export async function approveBrokerCommissionAction(
  id: string,
  _prev: BrokerCommissionActionState,
  formData: FormData,
): Promise<BrokerCommissionActionState> {
  const notes = str(formData, 'notes');
  try {
    await api.patch(`/broker-commissions/${id}/approve`, { notes });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-commissions/${id}`);
  revalidatePath('/dashboard/broker-commissions');
  return { ok: true };
}

export async function rejectBrokerCommissionAction(
  id: string,
  _prev: BrokerCommissionActionState,
  formData: FormData,
): Promise<BrokerCommissionActionState> {
  const reason = str(formData, 'reason');
  if (!reason) return { error: 'سبب الرفض مطلوب' };
  try {
    await api.patch(`/broker-commissions/${id}/reject`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-commissions/${id}`);
  revalidatePath('/dashboard/broker-commissions');
  return { ok: true };
}

export async function cancelBrokerCommissionAction(
  id: string,
  _prev: BrokerCommissionActionState,
  formData: FormData,
): Promise<BrokerCommissionActionState> {
  const reason = str(formData, 'reason');
  if (!reason) return { error: 'سبب الإلغاء مطلوب' };
  try {
    await api.patch(`/broker-commissions/${id}/cancel`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-commissions/${id}`);
  revalidatePath('/dashboard/broker-commissions');
  return { ok: true };
}
