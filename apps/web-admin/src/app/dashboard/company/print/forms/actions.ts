'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import type { FormDocument, FormField, FormLayout, PaperSize } from '@/lib/form-layout';

export type FormActionResult = { ok: true; id?: string } | { ok: false; error: string };

export interface FormLayoutInput {
  documentType: FormDocument;
  paperSize: PaperSize;
  name: string;
  pages: { imageUrl: string }[];
  fields: FormField[];
  isDefault: boolean;
}

export async function saveFormAction(id: string | null, input: FormLayoutInput): Promise<FormActionResult> {
  try {
    const saved = id
      ? await api.put<FormLayout>(`/form-layouts/${id}`, input)
      : await api.post<FormLayout>('/form-layouts', input);
    revalidatePath('/dashboard/company/print');
    return { ok: true, id: saved.id };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteFormAction(id: string): Promise<FormActionResult> {
  try {
    await api.delete(`/form-layouts/${id}`);
    revalidatePath('/dashboard/company/print');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}
