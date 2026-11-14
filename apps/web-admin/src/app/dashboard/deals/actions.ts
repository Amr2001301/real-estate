'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface DealFormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => str(f, k) || undefined;

function refresh(id?: string) {
  revalidatePath('/dashboard/deals', 'layout');
  if (id) revalidatePath(`/dashboard/deals/${id}`);
}

/** Run one API call; a refusal comes back as the form's error line. */
async function attempt(fn: () => Promise<unknown>, id?: string): Promise<DealFormState> {
  try {
    await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  refresh(id);
  return { ok: true };
}

export async function createDealAction(_prev: DealFormState, f: FormData): Promise<DealFormState> {
  let id: string;
  try {
    const listingId = opt(f, 'listingId');
    const leadId = opt(f, 'leadId');
    id = (
      await api.post<{ id: string }>('/deals', {
        listingId,
        kind: listingId ? undefined : opt(f, 'kind'),
        leadId,
        customerName: leadId ? undefined : opt(f, 'customerName'),
        customerPhone: leadId ? undefined : opt(f, 'customerPhone'),
        dealValue: Number(str(f, 'dealValue')),
        commissionTotal: Number(str(f, 'commissionTotal')),
        closedOn: str(f, 'closedOn'),
        developerName: opt(f, 'developerName'),
        agentId: opt(f, 'agentId'),
        notes: opt(f, 'notes'),
        ...(opt(f, 'coBrokerPct') ? { coBrokerName: opt(f, 'coBrokerName'), coBrokerPhone: opt(f, 'coBrokerPhone'), coBrokerPct: Number(str(f, 'coBrokerPct')) } : {}),
      })
    ).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  refresh();
  revalidatePath('/dashboard/listings', 'layout');
  redirect(`/dashboard/deals/${id}`);
}

export async function cancelDealAction(id: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  const res = await attempt(() => api.post(`/deals/${id}/cancel`, { reason: str(f, 'reason') }), id);
  revalidatePath('/dashboard/listings', 'layout');
  return res;
}

export async function recordCommissionAction(id: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(() => api.patch(`/deals/${id}/commission`, { commissionReceived: Number(str(f, 'commissionReceived')) }), id);
}

export async function submitClaimAction(dealId: string, claimId: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/claims/${claimId}/submit`, { submittedOn: str(f, 'submittedOn'), notes: opt(f, 'notes') }), dealId);
}

export async function rejectClaimAction(dealId: string, claimId: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/claims/${claimId}/reject`, { notes: str(f, 'notes') }), dealId);
}

export async function recordClaimPaymentAction(dealId: string, claimId: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(
    () => api.post(`/deals/claims/${claimId}/payments`, { amount: Number(str(f, 'amount')), receivedOn: str(f, 'receivedOn'), note: opt(f, 'note') }),
    dealId,
  );
}

export async function removeClaimPaymentAction(dealId: string, paymentId: string): Promise<DealFormState> {
  return attempt(() => api.delete(`/deals/claim-payments/${paymentId}`), dealId);
}

export async function paySplitAction(dealId: string, splitId: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/splits/${splitId}/pay`, {}), dealId);
}

export async function unpaySplitAction(dealId: string, splitId: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/splits/${splitId}/unpay`, {}), dealId);
}

export async function setRuleAction(kind: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(() => api.put(`/deals/rules/${kind}`, { agentPct: Number(str(f, 'agentPct')), managerPct: Number(str(f, 'managerPct')) }));
}

export async function setTargetAction(period: string, userId: string, _prev: DealFormState, f: FormData): Promise<DealFormState> {
  return attempt(() =>
    api.put(`/deals/targets/${period}/${userId}`, {
      commissionTarget: Number(str(f, 'commissionTarget') || 0),
      dealsTarget: Number(str(f, 'dealsTarget') || 0),
      bonusAmount: Number(str(f, 'bonusAmount') || 0),
    }),
  );
}

export async function removeTargetAction(id: string): Promise<DealFormState> {
  return attempt(() => api.delete(`/deals/targets/${id}`));
}

export async function payBonusAction(id: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/targets/${id}/pay-bonus`, {}));
}

export async function unpayBonusAction(id: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/targets/${id}/unpay-bonus`, {}));
}

export async function payCoBrokerAction(dealId: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/${dealId}/co-broker/pay`, {}), dealId);
}

export async function unpayCoBrokerAction(dealId: string): Promise<DealFormState> {
  return attempt(() => api.post(`/deals/${dealId}/co-broker/unpay`, {}), dealId);
}
