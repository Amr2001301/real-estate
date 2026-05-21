'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, api } from '@/lib/api';

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export interface BrokerLeadActionState {
  error?: string;
  ok?: boolean;
  /** True when the failure was a 403 missing_permission, so the form can show
   *  a friendly "you need permission X" state instead of a raw error banner. */
  missingPermission?: boolean;
  /** Permission codes the user is missing (when missingPermission is true). */
  permissions?: string[];
}

/** Translate any thrown error into the action state. A missing_permission 403
 *  is surfaced with its codes so the UI can render PermissionDeniedState. */
function toErrorState(e: unknown): BrokerLeadActionState {
  if (e instanceof ApiError && e.code === 'missing_permission') {
    return {
      error: e.message,
      missingPermission: true,
      permissions: e.permissions ?? [],
    };
  }
  return { error: (e as Error).message };
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
    return toErrorState(e);
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
    return toErrorState(e);
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
    return toErrorState(e);
  }
  revalidatePath(`/dashboard/broker-leads/${id}`);
  revalidatePath('/dashboard/broker-leads');
  return { ok: true };
}
