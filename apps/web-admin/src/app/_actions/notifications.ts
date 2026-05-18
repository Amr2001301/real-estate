'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

function basePathFrom(formData: FormData): '/dashboard' | '/portal' {
  const v = String(formData.get('basePath') ?? '/dashboard');
  return v === '/portal' ? '/portal' : '/dashboard';
}

export async function markNotificationReadAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const base = basePathFrom(formData);
  if (!id) return;
  try {
    await api.patch(`/me/notifications/${id}/read`);
  } catch {
    // swallow — UI will refresh and reflect the real state on next load
  }
  revalidatePath(`${base}/notifications`);
  revalidatePath(base);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const base = basePathFrom(formData);
  try {
    await api.patch('/me/notifications/read-all');
  } catch {
    // ignore
  }
  revalidatePath(`${base}/notifications`);
  revalidatePath(base);
}
