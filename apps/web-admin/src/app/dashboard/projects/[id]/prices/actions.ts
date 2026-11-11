'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

/** Saves the company's own price per meter for a type (empty type = the whole project). */
export async function setPriceRateAction(projectId: string, unitType: string | null, formData: FormData) {
  const pricePerMeter = Number(String(formData.get('pricePerMeter') ?? '').replace(/,/g, ''));
  let err: string | null = null;
  try {
    await api.put(`/projects/${projectId}/price-rates`, { unitType, pricePerMeter });
  } catch (e) {
    unstable_rethrow(e);
    err = (e as Error).message;
  }
  const path = `/dashboard/projects/${projectId}/prices`;
  revalidatePath(path);
  redirect(`${path}?${err ? `err=${encodeURIComponent(err)}` : 'ok=1'}` as never);
}
