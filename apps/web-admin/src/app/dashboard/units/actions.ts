'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import type { Phase, UnitModelOption } from '@/lib/types';

export interface UnitFormState {
  error?: string;
  ok?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An optional spec: empty → null (cleared). */
function optNumber(formData: FormData, name: string): number | null {
  const v = String(formData.get(name) ?? '').trim();
  return v === '' ? null : Number(v);
}
function optEnum(formData: FormData, name: string): string | null {
  return String(formData.get(name) ?? '').trim() || null;
}

function buildPayload(formData: FormData) {
  return {
    buildingId: String(formData.get('buildingId') ?? ''),
    code: String(formData.get('code') ?? ''),
    type: String(formData.get('type') ?? ''),
    area: Number(formData.get('area') ?? 0),
    bedrooms: Number(formData.get('bedrooms') ?? 0),
    bathrooms: Number(formData.get('bathrooms') ?? 0),
    floor: Number(formData.get('floor') ?? 0),
    // Priced by the meter: the API computes the total.
    pricePerMeter: optNumber(formData, 'pricePerMeter'),
    modelId: optEnum(formData, 'modelId'),
    // Empty → the phase's date.
    deliveryDate: optEnum(formData, 'deliveryDate'),
    netArea: optNumber(formData, 'netArea'),
    gardenArea: optNumber(formData, 'gardenArea'),
    roofArea: optNumber(formData, 'roofArea'),
    terraceArea: optNumber(formData, 'terraceArea'),
    landArea: optNumber(formData, 'landArea'),
    finishing: optEnum(formData, 'finishing'),
    view: optEnum(formData, 'view'),
    orientation: optEnum(formData, 'orientation'),
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
    unstable_rethrow(e);
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
  // status is handled separately to track history; only update non-status fields here.
  // The building is not editable (the API refuses it: a unit is not moved).
  const { status, buildingId: _building, ...fields } = payload;
  // A unit entered before pricing by the meter, its price ÷ area shown and
  // left as it was (with its area): no price change is sent — its whole
  // price stays (and a unit in a deal keeps passing the edit).
  const untouched =
    formData.get('pricedByMeter') === '0' &&
    String(formData.get('pricePerMeter') ?? '') === String(formData.get('pricePerMeterInitial') ?? '') &&
    String(formData.get('area') ?? '') === String(formData.get('areaInitial') ?? '');
  const rest = untouched ? { ...fields, pricePerMeter: undefined } : fields;
  try {
    await api.patch(`/units/${id}`, rest);
    const current = await api.get<{ status: string }>(`/units/${id}`);
    if (current.status !== status) {
      const reason = String(formData.get('statusReason') ?? '').trim() || undefined;
      await api.patch(`/units/${id}/status`, { status, reason });
    }
  } catch (e) {
    unstable_rethrow(e);
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

/** A project's unit models (F10), for the unit form. */
export async function getProjectModelsAction(projectId: string): Promise<UnitModelOption[]> {
  if (!UUID_RE.test(projectId)) return [];
  try {
    return await api.get<UnitModelOption[]>(`/projects/${projectId}/unit-models`);
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}

/** Fetches a project's phases+buildings server-side (with proper auth). */
export async function getProjectPhasesAction(projectId: string): Promise<Phase[]> {
  if (!UUID_RE.test(projectId)) return [];
  try {
    const project = await api.get<{ phases?: Phase[] }>(`/projects/${projectId}`);
    return project.phases ?? [];
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}
