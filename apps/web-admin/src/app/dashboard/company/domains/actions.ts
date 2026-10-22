'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export type DomainActionResult = { ok: true; verified?: boolean } | { ok: false; error: string };

async function run(fn: () => Promise<unknown>): Promise<DomainActionResult> {
  try {
    const res = (await fn()) as { verified?: boolean } | undefined;
    revalidatePath('/dashboard/company/domains');
    return { ok: true, verified: res?.verified };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function addDomainAction(hostname: string) {
  return run(() => api.post('/company-domains', { hostname }));
}

export async function verifyDomainAction(id: string) {
  return run(() => api.post(`/company-domains/${id}/verify`, {}));
}

export async function setPrimaryDomainAction(id: string) {
  return run(() => api.post(`/company-domains/${id}/primary`, {}));
}

export async function deleteDomainAction(id: string) {
  return run(() => api.delete(`/company-domains/${id}`));
}
