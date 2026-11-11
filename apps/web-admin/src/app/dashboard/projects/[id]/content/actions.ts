'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface ProjectContentResult {
  ok: boolean;
  error?: string;
  notifiedOwners?: number;
}

type Text = { ar: string; en: string };
export type ProjectContentPatch =
  | { sections: Array<{ title: Text; body: Text }> }
  | { faqs: Array<{ question: Text; answer: Text }> }
  | { amenities: Array<{ name: Text; icon: string; group: 'INSIDE' | 'AROUND' }> }
  | { progressStages: Array<{ name: Text; percent: number }>; notifyOwners?: boolean };

/** Saves one list of the project's page content (a list sent replaces the stored one). */
export async function saveProjectContentAction(projectId: string, patch: ProjectContentPatch): Promise<ProjectContentResult> {
  try {
    const res = await api.patch<{ notifiedOwners?: number }>(`/projects/${projectId}`, patch);
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath(`/dashboard/projects/${projectId}/content`);
    return { ok: true, notifiedOwners: res?.notifiedOwners ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : undefined };
  }
}

export interface ContentSuggestion {
  sections: Array<{ title: Text; body: Text }>;
  faqs: Array<{ question: Text; answer: Text }>;
  amenities: Array<{ name: Text; icon: string; group: 'INSIDE' | 'AROUND' }>;
}

/** «املأ من بيانات المشروع»: the content the project's records suggest (nothing is saved). */
export async function suggestProjectContentAction(projectId: string): Promise<ContentSuggestion | null> {
  try {
    return await api.get<ContentSuggestion>(`/projects/${projectId}/content-suggestion`);
  } catch {
    return null;
  }
}
