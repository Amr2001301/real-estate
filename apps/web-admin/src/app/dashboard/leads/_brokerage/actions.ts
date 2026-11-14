'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface MatchFormState {
  error?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const numOrNull = (f: FormData, k: string) => (str(f, k) === '' ? null : Number(str(f, k)));

/** BRK-5 — what a lead is looking for. */
export async function saveRequirementAction(leadId: string, _prev: MatchFormState, f: FormData): Promise<MatchFormState> {
  try {
    await api.put(`/listings/requirements/${leadId}`, {
      kinds: f.getAll('kinds').map(String),
      budgetMin: numOrNull(f, 'budgetMin'),
      budgetMax: numOrNull(f, 'budgetMax'),
      cities: str(f, 'cities').split(/[,،]/).map((c) => c.trim()).filter(Boolean),
      unitTypes: f.getAll('unitTypes').map(String).filter(Boolean),
      bedroomsMin: numOrNull(f, 'bedroomsMin'),
      areaMin: numOrNull(f, 'areaMin'),
      notes: str(f, 'notes') || undefined,
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}

/** BRK-5 — hand the unassigned leads to the picked reps, fewest open leads first. */
export async function distributeAction(_prev: MatchFormState & { assigned?: number }, f: FormData): Promise<MatchFormState & { assigned?: number }> {
  const salesIds = f.getAll('salesIds').map(String).filter(Boolean);
  if (!salesIds.length) return { error: 'pick' };
  try {
    const res = await api.post<{ assigned: number }>('/leads/distribute', { salesIds });
    revalidatePath('/dashboard/leads', 'layout');
    return { ok: true, assigned: res.assigned };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
}
