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
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`);
}
