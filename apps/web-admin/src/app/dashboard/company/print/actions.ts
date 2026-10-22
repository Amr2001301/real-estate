'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import type { DocumentTemplate, PrintSettings, TemplateDocument, TemplateVariant } from '@/lib/print-settings';

export type PrintActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<PrintActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/dashboard/company/print');
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}

export type PrintSettingsPatch = Partial<
  Pick<
    PrintSettings,
    | 'letterheadMode'
    | 'headerImageUrl'
    | 'footerImageUrl'
    | 'pageImageUrl'
    | 'marginTopMm'
    | 'marginBottomMm'
    | 'marginSideMm'
    | 'signatoryName'
    | 'signatoryTitle'
    | 'sealDocuments'
  >
>;

export async function savePrintSettingsAction(patch: PrintSettingsPatch) {
  return run(() => api.patch<PrintSettings>('/company/print-settings', patch));
}

/** The signature or stamp image, sent on to the API as a file. */
export async function uploadSealAction(asset: 'signature' | 'stamp', form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { ok: false as const, error: 'اختر صورة' };
  const body = new FormData();
  body.set('file', file, file.name);
  return run(() => api.put<PrintSettings>(`/company/print-settings/${asset}`, body));
}

export async function removeSealAction(asset: 'signature' | 'stamp') {
  return run(() => api.delete<PrintSettings>(`/company/print-settings/${asset}`));
}

export interface TemplateInput {
  documentType?: TemplateDocument;
  variant?: TemplateVariant;
  name?: string;
  body?: string;
  isDefault?: boolean;
}

export async function createTemplateAction(input: TemplateInput) {
  return run(() => api.post<DocumentTemplate>('/document-templates', input));
}

export async function updateTemplateAction(id: string, input: TemplateInput) {
  return run(() => api.patch<DocumentTemplate>(`/document-templates/${id}`, input));
}

export async function deleteTemplateAction(id: string) {
  return run(() => api.delete(`/document-templates/${id}`));
}
