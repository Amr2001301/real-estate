'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { depositPayload } from '@/lib/deposit-payload';
import { getCompanyTimeZone } from '@/lib/currency';
import { wallTimeToIso } from '@/lib/zoned-time';
import { lateFeesApplyFrom } from '@/components/form/late-fee-clause-field';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

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
    contractNumber: String(formData.get('contractNumber') ?? '').trim() || undefined,
    lateFeesApply: lateFeesApplyFrom(formData),
    preSystem: formData.get('preSystem') === 'on' ? true : undefined,
  };
  const signedAtRaw = String(formData.get('signedAt') ?? '').trim();
  const signedAt = signedAtRaw ? wallTimeToIso(signedAtRaw, await getCompanyTimeZone()) : undefined;
  // Signed before the system: it is entered signed, on a past date.
  if (payload.preSystem && (!signedAt || new Date(signedAt) > new Date())) {
    return { error: uiT(await getLocale()).pages.contractsForm.errorPreSystemSignedAt };
  }

  let created: { id: string };
  try {
    created = await api.post<{ id: string }>('/contracts', payload);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }

  // Optional signing step. If signing fails, the contract was still created;
  // we surface the error so the user knows to retry signing from the detail
  // page rather than re-submitting the create form (which would duplicate).
  if (signedAt) {
    try {
      await api.post(`/contracts/${created.id}/sign`, { signedAt });
    } catch (e) {
      unstable_rethrow(e);
      revalidatePath('/dashboard/contracts');
      return {
        error: `تم إنشاء العقد لكن فشل التوقيع: ${(e as Error).message}. افتح صفحة العقد من القائمة وحاول التوقيع مرة أخرى.`,
      };
    }
  }

  revalidatePath('/dashboard/contracts');
  redirect(`/dashboard/contracts/${created.id}`);
}

// Signing is its own step (the strict `contracts:sign` permission): a contract
// converted without a signing date stayed unsigned, with no way to sign it.
export async function setLateFeeClauseAction(id: string, lateFeesApply: boolean): Promise<ContractFormState> {
  try {
    await api.patch(`/contracts/${id}/late-fee-clause`, { lateFeesApply });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

export async function signContractAction(
  id: string,
  signedAt: string,
  deliveryDate?: string,
): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/sign`, { signedAt, ...(deliveryDate ? { deliveryDate } : {}) });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  revalidatePath('/dashboard/contracts');
  return {};
}

/** F10 — the handover date the contract promises; empty clears it. */
export async function setContractDeliveryAction(id: string, deliveryDate: string): Promise<ContractFormState> {
  try {
    await api.patch(`/contracts/${id}`, { deliveryDate: deliveryDate || null });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

// FG-04 — numbers a contract that has none; empty → the API assigns the next one.
export async function assignContractNumberAction(
  id: string,
  contractNumber: string,
): Promise<ContractFormState> {
  try {
    await api.patch(`/contracts/${id}`, contractNumber ? { contractNumber } : { autoNumber: true });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  revalidatePath('/dashboard/contracts');
  return { ok: true };
}

// The unit handed over: warranties start and maintenance opens from its date.
export async function recordHandoverAction(
  id: string,
  body: { handedOverAt: string; checklist: Array<{ key: string; done: boolean }>; notes?: string },
): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/handover`, body);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

// FG-10 — re-runs warranties + commissions of a signed contract after a failure.
export async function retrySignFollowupsAction(id: string): Promise<ContractFormState> {
  let res: { failures: { step: string; error: string }[] };
  try {
    res = await api.post<{ failures: { step: string; error: string }[] }>(`/contracts/${id}/sign-followups`, {});
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  if (res.failures.length) return { error: res.failures.map((f) => `${f.step}: ${f.error}`).join(' · ') };
  return { ok: true };
}

export async function attachContractPdfAction(id: string, pdfUrl: string) {
  await api.patch(`/contracts/${id}`, { pdfUrl });
  revalidatePath(`/dashboard/contracts/${id}`);
}

export async function createInstallmentPlanAction(
  contractId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  // Left empty, the monthly amount is computed from the contract (total minus
  // down payment, over the months); a typed one must fit the contract.
  const monthly = String(formData.get('monthlyAmount') ?? '').trim();
  try {
    await api.post('/installment-plans', {
      contractId,
      totalMonths: Number(formData.get('totalMonths') ?? 12),
      ...(monthly ? { monthlyAmount: Number(monthly) } : {}),
      startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${contractId}`);
  return {};
}

export async function recordInstallmentPaymentAction(
  contractId: string,
  installmentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  // The same body as the "تسجيل دفعة" page: the row used to be saved with
  // no payment method, out of every method report and reconciliation.
  const payload = depositPayload(formData, { contractId, installmentId }, await getCompanyTimeZone());
  try {
    await api.post('/deposits', payload);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${contractId}`);
  revalidatePath('/dashboard/deposits');
  return {};
}

const num = (v: ReturnType<FormData["get"]>) => Number(String(v ?? '').trim() || 0);
const str = (v: ReturnType<FormData["get"]>) => String(v ?? '').trim() || undefined;

// Cancels the contract with the amounts the admin settled (pre-filled from the
// company's cancellation policy).
export async function cancelContractAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/cancel`, {
      reason: str(formData.get('reason')),
      retainedAmount: num(formData.get('retainedAmount')),
      refundAmount: num(formData.get('refundAmount')),
      financialNotes: str(formData.get('financialNotes')),
      unitReleaseOverride: str(formData.get('unitRelease')),
      commissionActionOverride: str(formData.get('commissionAction')),
      bonusActionOverride: str(formData.get('bonusAction')),
      demoteCustomerOverride: formData.get('demoteCustomer') === 'on',
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  revalidatePath('/dashboard/contracts');
  return { ok: true };
}

// Records money paid back to the customer of a cancelled contract.
export async function recordRefundAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/refunds`, {
      amount: num(formData.get('amount')),
      paymentMethod: str(formData.get('paymentMethod')),
      referenceNumber: str(formData.get('referenceNumber')),
      bankName: str(formData.get('bankName')),
      paidAt: str(formData.get('paidAt')),
      notes: str(formData.get('notes')),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

// Puts the unit of a cancelled contract back on sale.
export async function releaseContractUnitAction(id: string): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/release-unit`, {});
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}


export async function waiveLateFeeAction(contractId: string, installmentId: string): Promise<ContractFormState> {
  try {
    await api.post(`/installments/${installmentId}/waive-late-fee`, {});
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${contractId}`);
  return { ok: true };
}

// تنازل — the contract passes to another customer.
export async function transferContractAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/transfer`, {
      toCustomerId: String(formData.get('toCustomerId') ?? ''),
      reason: String(formData.get('reason') ?? '').trim(),
      // Empty → the company's transfer-fee setting applies.
      ...(String(formData.get('feeAmount') ?? '').trim() !== ''
        ? { feeAmount: Number(formData.get('feeAmount')) }
        : {}),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

// تبديل — the contract moves to another unit at a new price.
export async function swapContractUnitAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/swap-unit`, {
      unitId: String(formData.get('unitId') ?? ''),
      totalAmount: Number(formData.get('totalAmount')),
      reason: String(formData.get('reason') ?? '').trim(),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

function done(id: string): ContractFormState {
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true };
}

// One payment for several installments (cash or transfer).
export async function payInstallmentsAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/deposits/batch`, {
      contractId: id,
      installmentIds: String(formData.get('installmentIds') ?? '').split(',').filter(Boolean),
      amount: Number(formData.get('amount')),
      paymentMethod: String(formData.get('paymentMethod') ?? 'CASH'),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  return done(id);
}

// سداد مبكر — everything still open, for exactly what is left.
export async function settleContractAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/deposits/settle`, {
      contractId: id,
      amount: Number(formData.get('amount')),
      paymentMethod: String(formData.get('paymentMethod') ?? 'CASH'),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  return done(id);
}

// A new contract price; the unpaid installments absorb the difference.
export async function changeContractPriceAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/price`, {
      totalAmount: Number(formData.get('totalAmount')),
      reason: String(formData.get('reason') ?? '').trim(),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  return done(id);
}

// Unearned instalment markup waived (early settlement); the sale price stays.
export async function waiveMarkupAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/waive-markup`, {
      amount: Number(formData.get('amount')),
      reason: String(formData.get('reason') ?? '').trim(),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  return done(id);
}

// The unpaid monthly installments spread over a new number of months.
export async function rescheduleContractAction(id: string, formData: FormData): Promise<ContractFormState> {
  try {
    await api.post(`/contracts/${id}/reschedule`, {
      months: Number(formData.get('months')),
      startsAt: String(formData.get('startsAt') ?? ''),
      reason: String(formData.get('reason') ?? '').trim(),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  return done(id);
}

// A contract signed before the system: what the customer paid before it was
// entered, each instalment on its due date.
export async function paidBeforeSystemAction(
  id: string,
  upTo: string,
): Promise<ContractFormState & { count?: number }> {
  let res: { count: number };
  try {
    res = await api.post<{ count: number }>(`/deposits/paid-before-system`, {
      contractId: id,
      ...(upTo ? { upTo } : {}),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/contracts/${id}`);
  return { ok: true, count: res.count };
}
