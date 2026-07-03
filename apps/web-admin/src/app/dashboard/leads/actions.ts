'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { LeadStage } from '@/lib/types';

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

export async function createSourceAction(formData: FormData) {
  await api.post('/lead-sources', {
    ar: String(formData.get('ar') ?? ''),
    en: String(formData.get('en') ?? ''),
  });
  revalidatePath('/dashboard/leads');
}
