'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

async function patch(id: string, body: { addPermissionCodes?: string[]; removePermissionCodes?: string[] }) {
  let errMessage: string | null = null;
  try {
    await api.patch(`/users/${id}/permissions`, body);
  } catch (e) {
    errMessage = (e as Error).message;
  }
  revalidatePath(`/dashboard/users/${id}/permissions`);
  if (errMessage) {
    redirect(`/dashboard/users/${id}/permissions?err=${encodeURIComponent(errMessage)}`);
  }
  redirect(`/dashboard/users/${id}/permissions?ok=1`);
}

export async function grantPermissionAction(id: string, formData: FormData) {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    redirect(`/dashboard/users/${id}/permissions?err=${encodeURIComponent('الرمز مطلوب')}`);
  }
  await patch(id, { addPermissionCodes: [code] });
}

export async function revokePermissionAction(id: string, formData: FormData) {
  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    redirect(`/dashboard/users/${id}/permissions?err=${encodeURIComponent('الرمز مطلوب')}`);
  }
  await patch(id, { removePermissionCodes: [code] });
}
