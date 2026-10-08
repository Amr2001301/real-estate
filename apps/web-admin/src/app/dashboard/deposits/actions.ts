'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export interface DepositFormState {
  error?: string;
  ok?: boolean;
}

export async function recordDepositAction(
  _prev: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> {
  const str = (k: string) => String(formData.get(k) ?? '').trim() || undefined;
  const paymentMethod = str('paymentMethod');
  const payload = {
    contractId: String(formData.get('contractId') ?? ''),
    installmentId: str('installmentId'),
    amount: Number(formData.get('amount') ?? 0),
    paidAt: str('paidAt'),
    receiptUrl: str('receiptUrl'),
    paymentMethod,
    // FG-01 — a cheque is tracked until it clears; transfer details are optional.
    cheque:
      paymentMethod === 'CHEQUE'
        ? {
            chequeNumber: str('chequeNumber'),
            drawerBankName: str('drawerBankName'),
            chequeDueDate: str('chequeDueDate'),
          }
        : undefined,
    transfer:
      paymentMethod === 'BANK_TRANSFER' && (str('transferBank') || str('transferRef'))
        ? { bankName: str('transferBank'), referenceNumber: str('transferRef') }
        : undefined,
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

// FG-05 — reverse / delete / restore from the deposit page. The API reverses a
// deposit that still pays its installment before deleting it.
function revalidateDeposit(id: string, contractId: string | null) {
  revalidatePath('/dashboard/deposits');
  revalidatePath(`/dashboard/deposits/${id}`);
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`);
}

export async function reverseDepositAction(
  _prev: DepositFormState,
  formData: FormData,
): Promise<DepositFormState> {
  const id = String(formData.get('depositId') ?? '');
  const contractId = String(formData.get('contractId') ?? '') || null;
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reason) return { error: uiT(await getLocale()).pages.depositsDetail.manage.reasonRequired };
  try {
    await api.post(`/deposits/${id}/reverse`, { reason });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateDeposit(id, contractId);
  return { ok: true };
}

export async function deleteDepositAction(id: string, contractId: string | null): Promise<DepositFormState> {
  try {
    await api.delete(`/deposits/${id}`);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateDeposit(id, contractId);
  return { ok: true };
}

export async function restoreDepositAction(id: string, contractId: string | null): Promise<DepositFormState> {
  try {
    await api.post(`/deposits/${id}/restore`, {});
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidateDeposit(id, contractId);
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
