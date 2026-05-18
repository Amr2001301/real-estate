'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { PortalVisitRequest } from '@/lib/types';

export interface PortalVisitFormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export async function createPortalVisitRequestAction(
  _prev: PortalVisitFormState,
  formData: FormData,
): Promise<PortalVisitFormState> {
  const projectId = str(formData, 'projectId');
  const preferredDate = str(formData, 'preferredDate');
  if (!projectId) return { error: 'المشروع مطلوب' };
  if (!preferredDate) return { error: 'تاريخ الزيارة المقترح مطلوب' };

  // <input type="date"> returns YYYY-MM-DD; promote to ISO datetime at UTC midnight.
  const preferredDateIso = /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
    ? `${preferredDate}T00:00:00.000Z`
    : preferredDate;

  const leadId = str(formData, 'leadId');
  const payload = {
    leadId,
    projectId,
    unitId: str(formData, 'unitId'),
    preferredDate: preferredDateIso,
    notes: str(formData, 'notes'),
    customerName: str(formData, 'customerName'),
    customerPhone: str(formData, 'customerPhone'),
    customerEmail: str(formData, 'customerEmail'),
  };

  if (!leadId && (!payload.customerName || !payload.customerPhone)) {
    return {
      error: 'اسم العميل ورقم الجوال مطلوبان عند عدم اختيار فرصة موجودة',
    };
  }

  try {
    await api.post<PortalVisitRequest>('/portal/visits/requests', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/portal/visits');
  revalidatePath('/portal');
  redirect('/portal/visits');
}
