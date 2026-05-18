'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { PortalLead } from '@/lib/types';

export interface PortalLeadFormState {
  error?: string;
  duplicate?: { id: string; isDuplicate: true };
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export async function createPortalLeadAction(
  _prev: PortalLeadFormState,
  formData: FormData,
): Promise<PortalLeadFormState> {
  const fullName = str(formData, 'fullName');
  const phone = str(formData, 'phone');
  if (!fullName || !phone) {
    return { error: 'الاسم الكامل ورقم الجوال مطلوبان' };
  }
  const payload = {
    fullName,
    phone,
    email: str(formData, 'email'),
    projectInterestId: str(formData, 'projectInterestId'),
    unitInterestId: str(formData, 'unitInterestId'),
    note: str(formData, 'note'),
  };

  let created: PortalLead;
  try {
    created = await api.post<PortalLead>('/portal/leads', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/portal/leads');
  revalidatePath('/portal');

  // If the API marked this as a duplicate, keep the broker on the form page
  // with a notice so they can decide what to do next.
  if (created.isDuplicate) {
    return { duplicate: { id: created.id, isDuplicate: true } };
  }
  redirect(`/portal/leads/${created.id}`);
}
