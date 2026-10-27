'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import type { LeadCallResult, LeadFollowUpType, LeadNoteKind, LeadStage } from '@/lib/types';

export interface LeadFormState {
  error?: string;
  ok?: boolean;
}

export async function createLeadAction(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const clientId = String(formData.get('clientId') ?? '').trim() || undefined;
  const fullName = String(formData.get('fullName') ?? '').trim() || undefined;
  const phone = String(formData.get('phone') ?? '').trim() || undefined;
  const email = String(formData.get('email') ?? '').trim() || undefined;

  // The picker submits either `clientId` (existing client) or
  // `fullName + phone (+ email)` (inline-create new client). Validate up
  // front so we surface a friendly error before hitting the API.
  if (!clientId && !phone) {
    return {
      error: 'اختر عميلاً موجوداً أو أدخل رقم هاتف لإنشاء عميل جديد.',
    };
  }
  if (!clientId && !fullName) {
    return { error: 'الاسم الكامل مطلوب لإنشاء عميل جديد.' };
  }

  const payload = {
    clientId,
    fullName,
    phone,
    email,
    sourceId: (String(formData.get('sourceId') ?? '').trim() || undefined),
    projectInterestId:
      (String(formData.get('projectInterestId') ?? '').trim() || undefined),
    unitInterestId:
      (String(formData.get('unitInterestId') ?? '').trim() || undefined),
    assignedSalesId:
      (String(formData.get('assignedSalesId') ?? '').trim() || undefined),
    notes: (String(formData.get('notes') ?? '').trim() || undefined),
  };

  let created;
  try {
    created = await api.post<{ id: string }>('/leads', payload);
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/leads');
  if (payload.clientId) revalidatePath(`/dashboard/clients/${payload.clientId}`);
  redirect(`/dashboard/leads/${created.id}`);
}

export async function updateStageAction(leadId: string, stage: LeadStage) {
  await api.patch(`/leads/${leadId}/stage`, { stage });
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath('/dashboard/leads');
}

export async function assignLeadAction(leadId: string, formData: FormData) {
  const assignedSalesId = String(formData.get('assignedSalesId') ?? '');
  if (!assignedSalesId) return;
  await api.patch(`/leads/${leadId}/assign`, { assignedSalesId });
  revalidatePath(`/dashboard/leads/${leadId}`);
}

export async function addNoteAction(leadId: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await api.post(`/leads/${leadId}/notes`, { body });
  revalidatePath(`/dashboard/leads/${leadId}`);
}

export interface LogActivityInput {
  body: string;
  kind: LeadNoteKind;
  callResult?: LeadCallResult | null;
  /** ISO instant sets the next follow-up, null clears it, undefined keeps it. */
  nextActionAt?: string | null;
  nextActionType?: LeadFollowUpType;
  nextActionNote?: string;
}

/** Logs an activity on a lead and its next follow-up (the composer on the lead page). */
export async function logActivityAction(leadId: string, input: LogActivityInput): Promise<LeadFormState> {
  if (!input.body.trim()) return { error: 'empty' };
  try {
    await api.post(`/leads/${leadId}/notes`, {
      body: input.body.trim(),
      kind: input.kind,
      ...(input.kind === 'CALL' && input.callResult ? { callResult: input.callResult } : {}),
      ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt } : {}),
      ...(input.nextActionAt ? { nextActionType: input.nextActionType, nextActionNote: input.nextActionNote?.trim() || undefined } : {}),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath('/dashboard/follow-ups');
  return { ok: true };
}

/** A text reply under a note on the lead's timeline. */
export async function replyNoteAction(leadId: string, parentId: string, body: string): Promise<LeadFormState> {
  if (!body.trim()) return { error: 'empty' };
  try {
    await api.post(`/leads/${leadId}/notes`, { body: body.trim(), parentId });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}

const SOURCES_PATH = '/dashboard/leads/sources';

async function sourceResult(run: () => Promise<unknown>): Promise<never> {
  let err: string | null = null;
  try {
    await run();
  } catch (e) {
    unstable_rethrow(e);
    err = (e as Error).message;
  }
  revalidatePath(SOURCES_PATH);
  revalidatePath('/dashboard/leads');
  redirect(`${SOURCES_PATH}?${err ? `err=${encodeURIComponent(err)}` : 'ok=1'}` as never);
}

export async function createSourceAction(formData: FormData) {
  await sourceResult(() =>
    api.post('/lead-sources', {
      ar: String(formData.get('ar') ?? '').trim(),
      en: String(formData.get('en') ?? '').trim(),
    }),
  );
}

export async function updateSourceAction(id: string, formData: FormData) {
  await sourceResult(() =>
    api.patch(`/lead-sources/${id}`, {
      ar: String(formData.get('ar') ?? '').trim(),
      en: String(formData.get('en') ?? '').trim(),
    }),
  );
}

export async function setSourceActiveAction(id: string, active: boolean) {
  await sourceResult(() => api.patch(`/lead-sources/${id}`, { active }));
}
