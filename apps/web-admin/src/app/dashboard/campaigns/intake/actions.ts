'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

const PATH = '/dashboard/campaigns/intake';

export interface IntakeActionResult {
  ok?: boolean;
  error?: string;
  /** A new key — shown once. */
  key?: string;
}

async function run(fn: () => Promise<unknown>, pick?: (r: unknown) => Partial<IntakeActionResult>): Promise<IntakeActionResult> {
  try {
    const r = await fn();
    revalidatePath(PATH);
    return { ok: true, ...(pick ? pick(r) : {}) };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
}

export async function createIntakeKeyAction(input: { name: string; campaignId?: string; projectId?: string }) {
  return run(
    () => api.post('/lead-intake/keys', { name: input.name.trim(), campaignId: input.campaignId || undefined, projectId: input.projectId || undefined }),
    (r) => ({ key: (r as { key: string }).key }),
  );
}

export async function updateIntakeKeyAction(id: string, patch: { active?: boolean; name?: string }) {
  return run(() => api.patch(`/lead-intake/keys/${id}`, patch));
}

export async function rotateIntakeKeyAction(id: string) {
  return run(() => api.post(`/lead-intake/keys/${id}/rotate`, {}), (r) => ({ key: (r as { key: string }).key }));
}

export async function deleteIntakeKeyAction(id: string) {
  return run(() => api.delete(`/lead-intake/keys/${id}`));
}

export async function saveRoutingAction(patch: { autoAssign?: 'ROUND_ROBIN' | 'NONE'; firstCallMinutes?: number }) {
  return run(() => api.put('/lead-intake/settings', patch));
}
