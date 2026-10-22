'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import type { CustomerFieldDef, CustomerFieldType } from '@/lib/customer-fields';

export type FieldActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<FieldActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/dashboard/company/customer-fields');
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function createFieldAction(input: {
  ar: string;
  en: string;
  type: CustomerFieldType;
  key?: string;
  options?: string[];
}) {
  return run(() => api.post<CustomerFieldDef>('/customer-fields', input));
}

export async function updateFieldAction(
  id: string,
  patch: { ar?: string; en?: string; options?: string[]; active?: boolean; order?: number },
) {
  return run(() => api.patch<CustomerFieldDef>(`/customer-fields/${id}`, patch));
}

/** The fields in the order given: each one's position is saved. */
export async function reorderFieldsAction(ids: string[]) {
  return run(() => Promise.all(ids.map((id, order) => api.patch(`/customer-fields/${id}`, { order }))));
}
