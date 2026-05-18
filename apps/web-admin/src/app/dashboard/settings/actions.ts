'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * Server action used by the rich PATCH form. Accepts the user-typed value
 * (string in the form), tries JSON.parse first, falls back to the raw
 * string. The API now accepts any JSON shape via PATCH (Phase 16).
 */
export async function patchSettingAction(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  const rawValue = String(formData.get('value') ?? '');
  if (!key) {
    redirect(`/dashboard/settings?err=${encodeURIComponent('المفتاح مطلوب')}`);
  }
  let value: unknown = rawValue;
  try {
    value = JSON.parse(rawValue);
  } catch {
    // Not JSON — store as a string literal.
    value = rawValue;
  }
  let errMessage: string | null = null;
  try {
    await api.patch(`/settings/${encodeURIComponent(key)}`, { value });
  } catch (e) {
    errMessage = (e as Error).message;
  }
  revalidatePath('/dashboard/settings');
  if (errMessage) {
    redirect(`/dashboard/settings?err=${encodeURIComponent(errMessage)}`);
  }
  redirect(`/dashboard/settings?ok=${encodeURIComponent(key)}`);
}
