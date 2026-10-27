'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface CampaignFormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

function payload(f: FormData, editing: boolean) {
  const opt = (k: string) => str(f, k) || (editing ? null : undefined);
  const budget = str(f, 'budget');
  return {
    name: str(f, 'name'),
    channel: str(f, 'channel') || undefined,
    status: str(f, 'status') || undefined,
    projectId: opt('projectId'),
    sourceId: opt('sourceId'),
    startDate: opt('startDate'),
    endDate: opt('endDate'),
    budget: budget ? Number(budget) : editing ? null : undefined,
    notes: opt('notes'),
    ...(editing ? {} : { code: str(f, 'code').toLowerCase() || undefined }),
  };
}

export async function createCampaignAction(_prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  let id: string;
  try {
    id = (await api.post<{ id: string }>('/campaigns', payload(formData, false))).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/campaigns');
  redirect(`/dashboard/campaigns/${id}`);
}

export async function updateCampaignAction(id: string, _prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  try {
    await api.patch(`/campaigns/${id}`, payload(formData, true));
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/campaigns');
  revalidatePath(`/dashboard/campaigns/${id}`);
  redirect(`/dashboard/campaigns/${id}`);
}

export async function addSpendAction(id: string, _prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  try {
    await api.post(`/campaigns/${id}/spend`, {
      amount: Number(str(formData, 'amount')),
      spentOn: str(formData, 'spentOn'),
      note: str(formData, 'note') || undefined,
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/campaigns/${id}`);
  revalidatePath('/dashboard/campaigns');
  return { ok: true };
}

export async function removeSpendAction(id: string, spendId: string): Promise<CampaignFormState> {
  try {
    await api.delete(`/campaigns/${id}/spend/${spendId}`);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/campaigns/${id}`);
  revalidatePath('/dashboard/campaigns');
  return { ok: true };
}
