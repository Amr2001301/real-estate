'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';

// ── Admin broadcast composer ──────────────────────────────────────────────────

export interface BroadcastPreviewResult {
  recipientCount?: number;
  pushEnabled?: boolean;
  /** PUSH: total registered device tokens across all recipients. */
  estimatedDeviceCount?: number;
  /** PUSH: number of recipients with no registered device token. */
  usersWithoutDevices?: number;
  error?: string;
}

export async function previewBroadcastAction(
  target: string,
  channel: string,
  targetUserId?: string,
  targetRole?: string,
): Promise<BroadcastPreviewResult> {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { error: 'هذه الميزة متاحة للمدير (ADMIN) فقط.' };
  }
  try {
    const payload: Record<string, unknown> = { target, channel };
    if (targetUserId) payload.targetUserId = targetUserId;
    if (targetRole)   payload.targetRole   = targetRole;
    const result = await api.post<{
      recipientCount: number;
      pushEnabled: boolean;
      estimatedDeviceCount?: number;
      usersWithoutDevices?: number;
    }>('/notifications/broadcast/preview', payload);
    return {
      recipientCount: result.recipientCount,
      pushEnabled: result.pushEnabled,
      estimatedDeviceCount: result.estimatedDeviceCount,
      usersWithoutDevices: result.usersWithoutDevices,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export interface BroadcastState {
  error?: string;
  ok?: boolean;
  broadcastId?: string;
  channel?: 'IN_APP' | 'PUSH';
  recipientCount?: number;
  // IN_APP counters
  notificationRecordsCreated?: number;
  failed?: number;
  // PUSH counters
  pushSent?: number;
  pushFailed?: number;
  noDeviceTokens?: number;
  /** Safe failure category from backend — no PII. */
  failureHint?: 'database_error' | 'no_device_tokens' | 'push_failed';
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
      channel: string;
      recipientCount: number;
      notificationRecordsCreated?: number;
      failed?: number;
      pushSent?: number;
      pushFailed?: number;
      noDeviceTokens?: number;
      failureHint?: string;
    }>('/notifications/broadcast', payload);
    revalidatePath('/dashboard/notifications');
    return {
      ok: true,
      broadcastId: result.broadcastId,
      channel: result.channel as BroadcastState['channel'],
      recipientCount: result.recipientCount,
      notificationRecordsCreated: result.notificationRecordsCreated,
      failed: result.failed,
      pushSent: result.pushSent,
      pushFailed: result.pushFailed,
      noDeviceTokens: result.noDeviceTokens,
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
