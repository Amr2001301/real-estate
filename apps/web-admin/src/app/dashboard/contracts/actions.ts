'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export interface ContractFormState {
  error?: string;
  ok?: boolean;
}

export async function createContractAction(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  // The API no longer accepts `signedAt` on POST /contracts — signing is a
  // separate strict action. The form may still include a `signedAt` value
  // (the visible field is unchanged); we split it into two API calls here.
  const payload = {
    customerId: String(formData.get('customerId') ?? ''),
    unitId: String(formData.get('unitId') ?? ''),
    totalAmount: Number(formData.get('totalAmount') ?? 0),
    downPayment: Number(formData.get('downPayment') ?? 0),
    pdfUrl: String(formData.get('pdfUrl') ?? '') || undefined,
  };
  const signedAt = String(formData.get('signedAt') ?? '') || undefined;

  let created: { id: string };
  try {
    created = await api.post<{ id: string }>('/contracts', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Optional signing step. If signing fails, the contract was still created;
  // we surface the error so the user knows to retry signing from the detail
  // page rather than re-submitting the create form (which would duplicate).
  if (signedAt) {
    try {
      await api.post(`/contracts/${created.id}/sign`, { signedAt });
    } catch (e) {
      revalidatePath('/dashboard/contracts');
      return {
        error: `تم إنشاء العقد لكن فشل التوقيع: ${(e as Error).message}. افتح صفحة العقد من القائمة وحاول التوقيع مرة أخرى.`,
      };
    }
  }

  revalidatePath('/dashboard/contracts');
  redirect(`/dashboard/contracts/${created.id}`);
}

export async function updateContractAction(
  id: string,
  formData: FormData,
) {
  const pdfUrl = String(formData.get('pdfUrl') ?? '') || undefined;
  const signedAt = String(formData.get('signedAt') ?? '') || undefined;

  // Generic update — pdfUrl only. The API no longer accepts signedAt on PATCH.
  if (pdfUrl !== undefined) {
    await api.patch(`/contracts/${id}`, { pdfUrl });
  }

  // Signing is a separate action (requires the strict `contracts:sign`
  // permission). Idempotent server-side: re-signing an already-signed
  // contract is a no-op.
  if (signedAt) {
    await api.post(`/contracts/${id}/sign`, { signedAt });
  }

  revalidatePath(`/dashboard/contracts/${id}`);
}

export async function attachContractPdfAction(id: string, pdfUrl: string) {
  await api.patch(`/contracts/${id}`, { pdfUrl });
  revalidatePath(`/dashboard/contracts/${id}`);
}

export async function createInstallmentPlanAction(contractId: string, formData: FormData) {
  await api.post('/installment-plans', {
    contractId,
    totalMonths: Number(formData.get('totalMonths') ?? 12),
    monthlyAmount: Number(formData.get('monthlyAmount') ?? 0),
    startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
  });
  revalidatePath(`/dashboard/contracts/${contractId}`);
}

export async function recordInstallmentPaymentAction(
  contractId: string,
  installmentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const payload = {
    contractId,
    installmentId,
    amount: Number(formData.get('amount') ?? 0),
    paidAt: String(formData.get('paidAt') ?? '') || undefined,
    receiptUrl: String(formData.get('receiptUrl') ?? '') || undefined,
  };
  try {
    await api.post('/deposits', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${contractId}`);
  revalidatePath('/dashboard/deposits');
  return {};
}
