'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

export interface ProjectFormState {
  error?: string;
  ok?: boolean;
}

function parseTranslatableJson(raw: string): { ar: string; en: string }[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { ar: string; en: string } =>
        item && typeof item === 'object' && typeof item.ar === 'string' && typeof item.en === 'string',
    );
  } catch {
    return [];
  }
}

function buildProjectPayload(formData: FormData) {
  return {
    name: {
      ar: String(formData.get('name_ar') ?? ''),
      en: String(formData.get('name_en') ?? ''),
    },
    description: {
      ar: String(formData.get('description_ar') ?? ''),
      en: String(formData.get('description_en') ?? ''),
    },
    city: String(formData.get('city') ?? ''),
    lat: Number(formData.get('lat') ?? 0),
    lng: Number(formData.get('lng') ?? 0),
    status: String(formData.get('status') ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    featured: formData.get('featured') === 'on',
    services: parseTranslatableJson(String(formData.get('services') ?? '')),
  };
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const payload = buildProjectPayload(formData);
  let created;
  try {
    created = await api.post<{ id: string }>('/projects', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/projects');
  redirect(`/dashboard/projects/${created.id}`);
}

export async function updateProjectAction(
  id: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const payload = buildProjectPayload(formData);
  try {
    await api.patch(`/projects/${id}`, payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath('/dashboard/projects');
  return { ok: true };
}

export async function publishProjectAction(id: string) {
  await api.patch(`/projects/${id}/publish`);
  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath('/dashboard/projects');
}

export async function archiveProjectAction(id: string) {
  await api.patch(`/projects/${id}/archive`);
  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath('/dashboard/projects');
}

export async function deleteProjectAction(id: string) {
  await api.delete(`/projects/${id}`);
  revalidatePath('/dashboard/projects');
  redirect('/dashboard/projects');
}

export async function deleteProjectMediaAction(projectId: string, mediaId: string) {
  await api.delete(`/media/projects/${mediaId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function createPhaseAction(projectId: string, formData: FormData) {
  await api.post('/phases', {
    projectId,
    name: {
      ar: String(formData.get('name_ar') ?? ''),
      en: String(formData.get('name_en') ?? ''),
    },
    order: Number(formData.get('order') ?? 0),
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function createBuildingAction(projectId: string, formData: FormData) {
  await api.post('/buildings', {
    phaseId: String(formData.get('phaseId')),
    name: String(formData.get('name')),
    totalFloors: Number(formData.get('totalFloors') ?? 1),
    order: Number(formData.get('order') ?? 0),
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}
