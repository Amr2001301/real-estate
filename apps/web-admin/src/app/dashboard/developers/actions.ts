'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface DevFormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => str(f, k) || undefined;
const pct = (f: FormData, k: string) => (str(f, k) === '' ? undefined : Number(str(f, k)));

async function attempt(fn: () => Promise<unknown>): Promise<DevFormState> {
  try {
    await fn();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/developers', 'layout');
  return { ok: true };
}

const developerBody = (f: FormData) => ({
  name: str(f, 'name'),
  contactName: opt(f, 'contactName'),
  phone: opt(f, 'phone'),
  email: opt(f, 'email'),
  website: opt(f, 'website'),
  defaultCommissionPct: pct(f, 'defaultCommissionPct'),
  notes: opt(f, 'notes'),
});

export async function createDeveloperAction(_prev: DevFormState, f: FormData): Promise<DevFormState> {
  let id: string;
  try {
    id = (await api.post<{ id: string }>('/developers', developerBody(f))).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/developers');
  redirect(`/dashboard/developers/${id}`);
}

export async function updateDeveloperAction(id: string, _prev: DevFormState, f: FormData): Promise<DevFormState> {
  return attempt(() => api.patch(`/developers/${id}`, developerBody(f)));
}

export async function setDeveloperActiveAction(id: string, active: boolean): Promise<DevFormState> {
  return attempt(() => api.patch(`/developers/${id}`, { active }));
}

export async function createProjectAction(developerId: string, _prev: DevFormState, f: FormData): Promise<DevFormState> {
  return attempt(() =>
    api.post(`/developers/${developerId}/projects`, {
      name: str(f, 'name'),
      city: opt(f, 'city'),
      district: opt(f, 'district'),
      commissionPct: pct(f, 'commissionPct'),
      deliveryDate: opt(f, 'deliveryDate'),
    }),
  );
}

export async function removeProjectAction(id: string): Promise<DevFormState> {
  return attempt(() => api.delete(`/developers/projects/${id}`));
}

export async function createPlanAction(projectId: string, _prev: DevFormState, f: FormData): Promise<DevFormState> {
  const years = Number(str(f, 'years') || 0);
  return attempt(() =>
    api.post(`/developers/projects/${projectId}/plans`, {
      name: str(f, 'name'),
      downPaymentPct: years === 0 ? 100 : Number(str(f, 'downPaymentPct') || 0),
      years,
      frequency: opt(f, 'frequency'),
      deliveryPct: years === 0 ? 0 : pct(f, 'deliveryPct'),
      cashDiscountPct: years === 0 ? pct(f, 'cashDiscountPct') : 0,
    }),
  );
}

export async function removePlanAction(id: string): Promise<DevFormState> {
  return attempt(() => api.delete(`/developers/plans/${id}`));
}
