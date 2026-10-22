'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface ClientFormState {
  error?: string;
  ok?: boolean;
}

type ClientRole = 'CLIENT' | 'CUSTOMER';

function pickStr(formData: FormData, key: string): string | undefined {
  const v = String(formData.get(key) ?? '').trim();
  return v ? v : undefined;
}

const DETAIL_KEYS = [
  'nationalId',
  'address',
  'birthDate',
  'birthPlace',
  'occupation',
  'employer',
  'nationalIdIssueDate',
  'nationalIdIssuePlace',
  'homePhone',
] as const;

/**
 * The customer's recorded details and company fields from the form. On an
 * edit an emptied field is sent as null, which clears it; on a create it is
 * left out.
 */
function recordFrom(formData: FormData, clear: boolean) {
  const empty = clear ? null : undefined;
  const out: Record<string, unknown> = {};
  for (const k of DETAIL_KEYS) out[k] = pickStr(formData, k) ?? empty;
  const custom: Record<string, string | null> = {};
  for (const [name, v] of formData.entries()) {
    if (!name.startsWith('custom.') || typeof v !== 'string') continue;
    const value = v.trim();
    if (value) custom[name.slice('custom.'.length)] = value;
    else if (clear) custom[name.slice('custom.'.length)] = null;
  }
  if (Object.keys(custom).length) out.customFields = custom;
  return out;
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const role: ClientRole =
    String(formData.get('role') ?? 'CLIENT') === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = pickStr(formData, 'email');
  const phone = pickStr(formData, 'phone');
  const locale = (pickStr(formData, 'locale') as 'ar' | 'en' | undefined) ?? 'ar';

  if (!fullName) return { error: 'الاسم مطلوب' };
  if (!email && !phone) return { error: 'يجب إدخال البريد الإلكتروني أو رقم الهاتف' };

  let created;
  try {
    created = await api.post<{ id: string }>('/users', {
      role,
      fullName,
      email,
      phone,
      locale,
      ...recordFrom(formData, false),
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/clients');
  redirect(`/dashboard/clients/${created.id}`);
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  // PATCH /users/:id takes the name, phone, language and the customer's
  // recorded details (an emptied one is cleared).
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = pickStr(formData, 'phone');
  const locale = pickStr(formData, 'locale') as 'ar' | 'en' | undefined;

  if (!fullName) return { error: 'الاسم مطلوب' };

  try {
    await api.patch(`/users/${id}`, { fullName, phone, locale, ...recordFrom(formData, true) });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath('/dashboard/clients');
  return { ok: true };
}

export async function activateClientAction(id: string) {
  await api.patch(`/users/${id}/activate`, {});
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath('/dashboard/clients');
}

export async function deactivateClientAction(id: string): Promise<{ error?: string }> {
  try {
    await api.patch(`/users/${id}/deactivate`, {});
  } catch (e) {
    unstable_rethrow(e);
    // e.g. the customer still has a live contract (cancel or transfer it first).
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath('/dashboard/clients');
  return {};
}
