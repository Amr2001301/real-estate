'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';

// ── Admin broadcast composer ──────────────────────────────────────────────────

export interface BroadcastPreviewResult {
  recipientCount?: number;
  pushEnabled?: boolean;
  error?: string;
}

export async function previewBroadcastAction(
  target: string,
  targetUserId?: string,
  targetRole?: string,
): Promise<BroadcastPreviewResult> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'هذه الميزة متاحة للمدير (ADMIN) فقط.' };
  }
  try {
    const payload: Record<string, unknown> = { target };
    if (targetUserId) payload.targetUserId = targetUserId;
    if (targetRole)   payload.targetRole   = targetRole;
    const result = await api.post<{ recipientCount: number; pushEnabled: boolean }>(
      '/notifications/broadcast/preview',
      payload,
    );
    return { recipientCount: result.recipientCount, pushEnabled: result.pushEnabled };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export interface BroadcastState {
  error?: string;
  ok?: boolean;
  broadcastId?: string;
  recipientCount?: number;
  sent?: number;
  failed?: number;
  /** Safe failure category returned by the backend for UI display. */
  failureHint?: 'template_missing' | 'push_not_configured' | 'database_error';
}

export async function broadcastNotificationAction(
  _prev: BroadcastState,
  formData: FormData,
): Promise<BroadcastState> {
  // Server-side role guard — backend also enforces this, but fail fast here
  // so the error message is clear rather than a generic 403.
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'هذه الميزة متاحة للمدير (ADMIN) فقط.' };
  }

  const get = (key: string) => {
    const v = formData.get(key);
    return v !== null ? String(v).trim() : '';
  };

  const title_ar = get('title_ar');
  const title_en = get('title_en');
  const body_ar   = get('body_ar');
  const body_en   = get('body_en');
  const target    = get('target');
  const channel   = get('channel') || 'IN_APP';

  if (!title_ar) return { error: 'العنوان بالعربية مطلوب' };
  if (!title_en) return { error: 'العنوان بالإنجليزية مطلوب' };
  if (!body_ar)  return { error: 'نص الرسالة بالعربية مطلوب' };
  if (!body_en)  return { error: 'نص الرسالة بالإنجليزية مطلوب' };
  if (!target)   return { error: 'نوع الجمهور مطلوب' };

  const payload: Record<string, unknown> = {
    title_ar, title_en, body_ar, body_en,
    target,
    channel,
  };

  const targetUserId = get('targetUserId');
  const targetRole   = get('targetRole');
  const entityType   = get('entityType');
  const entityId     = get('entityId');

  if (targetUserId) payload.targetUserId = targetUserId;
  if (targetRole)   payload.targetRole   = targetRole;
  if (entityType)   payload.entityType   = entityType;
  if (entityId)     payload.entityId     = entityId;

  try {
    const result = await api.post<{
      broadcastId: string;
      recipientCount: number;
      sent: number;
      failed: number;
      failureHint?: string;
    }>('/notifications/broadcast', payload);
    revalidatePath('/dashboard/notifications');
    return {
      ok: true,
      broadcastId: result.broadcastId,
      recipientCount: result.recipientCount,
      sent: result.sent,
      failed: result.failed,
      failureHint: result.failureHint as BroadcastState['failureHint'],
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

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
