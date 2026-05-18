'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { Phase } from '@/lib/types';

export interface UnitFormState {
  error?: string;
  ok?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildPayload(formData: FormData) {
  return {
    buildingId: String(formData.get('buildingId') ?? ''),
    code: String(formData.get('code') ?? ''),
    type: String(formData.get('type') ?? ''),
    area: Number(formData.get('area') ?? 0),
    bedrooms: Number(formData.get('bedrooms') ?? 0),
    bathrooms: Number(formData.get('bathrooms') ?? 0),
    floor: Number(formData.get('floor') ?? 0),
    price: Number(formData.get('price') ?? 0),
    status: String(formData.get('status') ?? 'AVAILABLE') as 'AVAILABLE' | 'RESERVED' | 'SOLD',
  };
}

export async function createUnitAction(
  _prev: UnitFormState,
  formData: FormData,
): Promise<UnitFormState> {
  const payload = buildPayload(formData);
  if (!UUID_RE.test(payload.buildingId)) {
    return { error: 'يرجى اختيار مشروع ومرحلة ومبنى قبل الحفظ' };
  }
  let created;
  try {
    created = await api.post<{ id: string }>('/units', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/units');
  redirect(`/dashboard/units/${created.id}`);
}

export async function updateUnitAction(
  id: string,
  _prev: UnitFormState,
  formData: FormData,
): Promise<UnitFormState> {
  const payload = buildPayload(formData);
  // status is handled separately to track history; only update non-status fields here
  const { status, ...rest } = payload;
  try {
    await api.patch(`/units/${id}`, rest);
    const current = await api.get<{ status: string }>(`/units/${id}`);
    if (current.status !== status) {
      await api.patch(`/units/${id}/status`, { status });
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/units/${id}`);
  revalidatePath('/dashboard/units');
  return { ok: true };
}

export async function deleteUnitAction(id: string) {
  await api.delete(`/units/${id}`);
  revalidatePath('/dashboard/units');
  redirect('/dashboard/units');
}

export async function deleteUnitMediaAction(unitId: string, mediaId: string) {
  await api.delete(`/media/units/${mediaId}`);
  revalidatePath(`/dashboard/units/${unitId}`);
}

/** Fetches a project's phases+buildings server-side (with proper auth). */
export async function getProjectPhasesAction(projectId: string): Promise<Phase[]> {
  if (!UUID_RE.test(projectId)) return [];
  try {
    const project = await api.get<{ phases?: Phase[] }>(`/projects/${projectId}`);
    return project.phases ?? [];
  } catch {
    return [];
  }
}
