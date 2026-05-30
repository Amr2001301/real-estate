'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export interface DepositFormState {
  error?: string;
  ok?: boolean;
}

export async function recordDepositAction(
  _prev: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> {
  const payload = {
    contractId: String(formData.get('contractId') ?? ''),
    installmentId: String(formData.get('installmentId') ?? '') || undefined,
    amount: Number(formData.get('amount') ?? 0),
    paidAt: String(formData.get('paidAt') ?? '') || undefined,
    receiptUrl: String(formData.get('receiptUrl') ?? '') || undefined,
  };
  try {
    await api.post('/deposits', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/deposits');
  revalidatePath(`/dashboard/contracts/${payload.contractId}`);
  redirect(`/dashboard/contracts/${payload.contractId}`);
}

export async function verifyDepositAction(id: string, contractId: string | null, verified: boolean) {
  await api.patch(`/deposits/${id}/verify`, { verified });
  revalidatePath('/dashboard/deposits');
  revalidatePath(`/dashboard/deposits/${id}`);
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`);
}

// P11 — explicit approve/reject endpoints for customer-submitted payment
// proofs. Approve is a thin wrapper around the strict-permission backend
// route; reject requires a non-empty reason and surfaces inline errors.

export async function approveDepositAction(
  id: string,
  contractId: string | null,
  note?: string,
): Promise<DepositFormState> {
  try {
    await api.post(`/deposits/${id}/approve`, note ? { note } : {});
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/deposits');
  revalidatePath(`/dashboard/deposits/${id}`);
  revalidatePath('/dashboard/payments/review');
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`);
  return { ok: true };
}

export async function rejectDepositAction(
  _prev: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> {
  const id = String(formData.get('depositId') ?? '');
  const contractId = String(formData.get('contractId') ?? '') || null;
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) return { error: 'معرّف الدفعة مطلوب' };
  if (!reason) return { error: 'سبب الرفض مطلوب' };
  if (reason.length > 2000) return { error: 'سبب الرفض طويل جداً (الحد 2000 حرف)' };
  try {
    await api.post(`/deposits/${id}/reject`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/deposits');
  revalidatePath(`/dashboard/deposits/${id}`);
  revalidatePath('/dashboard/payments/review');
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`);
  return { ok: true };
}

// P11 — attach a contract PDF (uploaded via the signed presign flow).
export async function attachContractDocumentAction(
  _prev: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> {
  const contractId = String(formData.get('contractId') ?? '');
  const fileUrl = String(formData.get('fileUrl') ?? '');
  if (!contractId || !fileUrl) return { error: 'فشل في إرفاق العقد' };
  try {
    await api.post(`/contracts/${contractId}/document`, {
      fileUrl,
      fileName: String(formData.get('fileName') ?? '') || undefined,
      mimeType: String(formData.get('mimeType') ?? '') || undefined,
      sizeBytes: Number(formData.get('sizeBytes') ?? 0) || undefined,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${contractId}`);
  return { ok: true };
}
