'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
    });
  } catch (e) {
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
  // API only accepts fullName, locale, phone for PATCH /users/:id
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = pickStr(formData, 'phone');
  const locale = pickStr(formData, 'locale') as 'ar' | 'en' | undefined;

  if (!fullName) return { error: 'الاسم مطلوب' };

  try {
    await api.patch(`/users/${id}`, { fullName, phone, locale });
  } catch (e) {
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

export async function deactivateClientAction(id: string) {
  await api.patch(`/users/${id}/deactivate`, {});
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath('/dashboard/clients');
}
