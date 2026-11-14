'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface LaunchFormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => str(f, k) || undefined;

async function attempt(fn: () => Promise<unknown>): Promise<LaunchFormState> {
  try {
    await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/launches', 'layout');
  return { ok: true };
}

export async function createLaunchAction(_prev: LaunchFormState, f: FormData): Promise<LaunchFormState> {
  let id: string;
  try {
    id = (
      await api.post<{ id: string }>('/launches', {
        name: str(f, 'name'),
        developerProjectId: opt(f, 'developerProjectId'),
        developerName: opt(f, 'developerName'),
        launchDate: str(f, 'launchDate'),
        eoiAmount: Number(str(f, 'eoiAmount') || 0),
        notes: opt(f, 'notes'),
      })
    ).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/launches');
  redirect(`/dashboard/launches/${id}`);
}

export async function setLaunchStatusAction(id: string, status: string): Promise<LaunchFormState> {
  return attempt(() => api.patch(`/launches/${id}`, { status }));
}

export async function createEoiAction(launchId: string, _prev: LaunchFormState, f: FormData): Promise<LaunchFormState> {
  const leadId = opt(f, 'leadId');
  return attempt(() =>
    api.post(`/launches/${launchId}/eois`, {
      leadId,
      customerName: leadId ? undefined : opt(f, 'customerName'),
      customerPhone: leadId ? undefined : opt(f, 'customerPhone'),
      preference: opt(f, 'preference'),
      budget: str(f, 'budget') ? Number(str(f, 'budget')) : undefined,
    }),
  );
}

export async function payEoiAction(id: string, _prev: LaunchFormState, f: FormData): Promise<LaunchFormState> {
  return attempt(() => api.post(`/launches/eois/${id}/pay`, { paymentRef: opt(f, 'paymentRef') }));
}

export async function allocateEoiAction(id: string, _prev: LaunchFormState, f: FormData): Promise<LaunchFormState> {
  return attempt(() => api.post(`/launches/eois/${id}/allocate`, { allocation: str(f, 'allocation') }));
}

export async function refundEoiAction(id: string): Promise<LaunchFormState> {
  return attempt(() => api.post(`/launches/eois/${id}/refund`, {}));
}

export async function cancelEoiAction(id: string): Promise<LaunchFormState> {
  return attempt(() => api.post(`/launches/eois/${id}/cancel`, {}));
}
