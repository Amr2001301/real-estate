'use server';

import { revalidatePath } from 'next/cache';
import { api, safe } from '@/lib/api';

export interface UpsertTargetInput {
  salesId: string;
  period: string; // YYYY-MM
  amountTarget: number;
  unitsTarget: number;
}

export async function upsertTarget(
  input: UpsertTargetInput,
): Promise<{ error?: string }> {
  const res = await safe(
    api.post('/sales-targets', {
      salesId: input.salesId,
      period: input.period,
      amountTarget: input.amountTarget,
      unitsTarget: input.unitsTarget,
    }),
  );

  if (res.error) return { error: res.error };

  revalidatePath('/dashboard/targets');
  return {};
}
