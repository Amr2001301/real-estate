'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export interface BrokerLeadActionState {
  error?: string;
  ok?: boolean;
}

export async function approveBrokerLeadAction(
  id: string,
  _prev: BrokerLeadActionState,
  formData: FormData,
): Promise<BrokerLeadActionState> {
  const assignedSalesId = str(formData, 'assignedSalesId');
  const note = str(formData, 'note');
  try {
    await api.patch(`/broker-leads/${id}/approve`, { assignedSalesId, note });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-leads/${id}`);
  revalidatePath('/dashboard/broker-leads');
  return { ok: true };
}

export async function rejectBrokerLeadAction(
  id: string,
  _prev: BrokerLeadActionState,
  formData: FormData,
): Promise<BrokerLeadActionState> {
  const reason = str(formData, 'reason');
  if (!reason) return { error: 'سبب الرفض مطلوب' };
  try {
    await api.patch(`/broker-leads/${id}/reject`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-leads/${id}`);
  revalidatePath('/dashboard/broker-leads');
  return { ok: true };
}

export async function markBrokerLeadDuplicateAction(
  id: string,
  _prev: BrokerLeadActionState,
  formData: FormData,
): Promise<BrokerLeadActionState> {
  const reason = str(formData, 'reason');
  try {
    await api.patch(`/broker-leads/${id}/mark-duplicate`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/broker-leads/${id}`);
  revalidatePath('/dashboard/broker-leads');
  return { ok: true };
}
