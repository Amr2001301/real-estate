'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

const num = (formData: FormData, name: string) => {
  const v = String(formData.get(name) ?? '').trim();
  return v === '' ? null : Number(v);
};

/** The model's layout fields from its form (empty → none). */
function layout(formData: FormData) {
  return {
    ar: String(formData.get('ar') ?? '').trim(),
    en: String(formData.get('en') ?? '').trim(),
    type: String(formData.get('type') ?? ''),
    area: Number(formData.get('area') ?? 0),
    netArea: num(formData, 'netArea'),
    gardenArea: num(formData, 'gardenArea'),
    roofArea: num(formData, 'roofArea'),
    terraceArea: num(formData, 'terraceArea'),
    landArea: num(formData, 'landArea'),
    bedrooms: num(formData, 'bedrooms') ?? 0,
    bathrooms: num(formData, 'bathrooms') ?? 0,
    finishing: String(formData.get('finishing') ?? '') || null,
  };
}

async function modelResult(projectId: string, run: () => Promise<unknown>): Promise<never> {
  let err: string | null = null;
  try {
    await run();
  } catch (e) {
    unstable_rethrow(e);
    err = (e as Error).message;
  }
  const path = `/dashboard/projects/${projectId}/models`;
  revalidatePath(path);
  redirect(`${path}?${err ? `err=${encodeURIComponent(err)}` : 'ok=1'}` as never);
}

export async function createUnitModelAction(projectId: string, formData: FormData) {
  await modelResult(projectId, () =>
    api.post(`/projects/${projectId}/unit-models`, { code: String(formData.get('code') ?? '').trim(), ...layout(formData) }),
  );
}

export async function updateUnitModelAction(projectId: string, id: string, formData: FormData) {
  await modelResult(projectId, () => api.patch(`/unit-models/${id}`, layout(formData)));
}

export async function setUnitModelActiveAction(projectId: string, id: string, active: boolean) {
  await modelResult(projectId, () => api.patch(`/unit-models/${id}`, { active }));
}
