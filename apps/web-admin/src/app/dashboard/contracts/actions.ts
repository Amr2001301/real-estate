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
  const payload = {
    customerId: String(formData.get('customerId') ?? ''),
    unitId: String(formData.get('unitId') ?? ''),
    totalAmount: Number(formData.get('totalAmount') ?? 0),
    downPayment: Number(formData.get('downPayment') ?? 0),
    pdfUrl: String(formData.get('pdfUrl') ?? '') || undefined,
    signedAt: String(formData.get('signedAt') ?? '') || undefined,
  };
  let created;
  try {
    created = await api.post<{ id: string }>('/contracts', payload);
  } catch (e) {
    return { error: (e as Error).message };
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
  await api.patch(`/contracts/${id}`, { pdfUrl, signedAt });
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
