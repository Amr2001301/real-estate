'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface RepriceState {
  error?: string;
  /** What the request did (or would do, for a preview). */
  result?: { updated: number; kept: number; stalePlans: number; applied: boolean };
}

/** Reprice by the meter the units for sale in a project, phase or building. */
export async function repriceAction(_prev: RepriceState, formData: FormData): Promise<RepriceState> {
  const field = (name: string) => String(formData.get(name) ?? '').trim() || undefined;
  const applied = formData.get('mode') === 'apply';
  try {
    const res = await api.post<{ updated: number; kept: number; stalePlans: number }>('/units/reprice', {
      projectId: field('projectId'),
      phaseId: field('phaseId'),
      buildingId: field('buildingId'),
      type: field('type'),
      pricePerMeter: Number(field('pricePerMeter') ?? 0),
      dryRun: !applied,
    });
    if (applied) revalidatePath('/dashboard/units');
    return { result: { ...res, applied } };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
}
