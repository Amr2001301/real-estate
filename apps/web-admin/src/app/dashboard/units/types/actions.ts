'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

const TYPES_PATH = '/dashboard/units/types';

async function typeResult(run: () => Promise<unknown>): Promise<never> {
  let err: string | null = null;
  try {
    await run();
  } catch (e) {
    unstable_rethrow(e);
    err = (e as Error).message;
  }
  revalidatePath(TYPES_PATH);
  revalidatePath('/dashboard/units');
  redirect(`${TYPES_PATH}?${err ? `err=${encodeURIComponent(err)}` : 'ok=1'}` as never);
}

export async function createUnitTypeAction(formData: FormData) {
  await typeResult(() =>
    api.post('/unit-types', {
      ar: String(formData.get('ar') ?? '').trim(),
      en: String(formData.get('en') ?? '').trim(),
      usage: String(formData.get('usage') ?? 'RESIDENTIAL'),
    }),
  );
}

export async function updateUnitTypeAction(id: string, formData: FormData) {
  await typeResult(() =>
    api.patch(`/unit-types/${id}`, {
      ar: String(formData.get('ar') ?? '').trim(),
      en: String(formData.get('en') ?? '').trim(),
      usage: String(formData.get('usage') ?? 'RESIDENTIAL'),
    }),
  );
}

export async function setUnitTypeActiveAction(id: string, active: boolean) {
  await typeResult(() => api.patch(`/unit-types/${id}`, { active }));
}
