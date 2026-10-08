'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

// FG-01 — cheque lifecycle on /payment-instruments. Clearing pays the linked
// installment and approves its deposit; a bounce or a cancel rejects it.

export interface ChequeActionState {
  error?: string;
  ok?: boolean;
}

function revalidate() {
  revalidatePath('/dashboard/cheques');
  revalidatePath('/dashboard/deposits');
  revalidatePath('/dashboard/installments');
}

async function run(path: string, body: Record<string, unknown> = {}): Promise<ChequeActionState> {
  try {
    await api.post(path, body);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidate();
  return { ok: true };
}

export async function depositChequeAction(id: string): Promise<ChequeActionState> {
  return run(`/payment-instruments/${id}/deposit`);
}

export async function cancelChequeAction(id: string): Promise<ChequeActionState> {
  return run(`/payment-instruments/${id}/cancel`);
}

export async function clearChequeAction(
  _prev: ChequeActionState,
  formData: FormData,
): Promise<ChequeActionState> {
  const id = String(formData.get('id') ?? '');
  const clearingDate = String(formData.get('clearingDate') ?? '') || undefined;
  return run(`/payment-instruments/${id}/clear`, { clearingDate });
}

export async function bounceChequeAction(
  _prev: ChequeActionState,
  formData: FormData,
): Promise<ChequeActionState> {
  const id = String(formData.get('id') ?? '');
  const penaltyAmount = Number(formData.get('penaltyAmount') ?? 0) || 0;
  return run(`/payment-instruments/${id}/bounce`, {
    bounceReason: String(formData.get('bounceReason') ?? '').trim(),
    bounceDate: String(formData.get('bounceDate') ?? ''),
    penaltyAmount,
    penaltyDueDate:
      penaltyAmount > 0 ? String(formData.get('penaltyDueDate') ?? '') || undefined : undefined,
  });
}
