import { cache } from 'react';
import { api, safe } from './api';
import type { FormDocument, FormLayout } from './form-layout';

/** Server-only: the company's paper forms for a document (the print and signing pages). */
export const getFormLayouts = cache(async (documentType: FormDocument): Promise<FormLayout[]> => {
  const res = await safe(api.get<FormLayout[]>(`/form-layouts?documentType=${documentType}`));
  return res.data ?? [];
});

/** The form a document prints on: the one asked for, else the default; `none` uses the platform's layout. */
export function pickForm(layouts: FormLayout[], requested?: string): FormLayout | null {
  if (requested === 'none') return null;
  if (requested) {
    const asked = layouts.find((l) => l.id === requested);
    if (asked) return asked;
  }
  return layouts.find((l) => l.isDefault) ?? null;
}
