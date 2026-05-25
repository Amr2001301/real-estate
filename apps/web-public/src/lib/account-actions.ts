'use server';

/**
 * Server actions for the authenticated /account portal. These run on the
 * server and call the backend via authFetch (Bearer from the httpOnly cookie;
 * refresh-on-401 works here because cookie writes are allowed in actions).
 * Tokens never reach client JS.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authFetch, AuthError } from '@/lib/api-auth';

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'fullName' | 'phone' };

/**
 * Update the signed-in user's profile → PATCH /v1/users/me. Sends ONLY the
 * allowed fields (fullName, phone) and re-validates server-side. The backend
 * UpdateUserDto further restricts what can change (no role/email/status).
 */
export async function updateProfileAction(input: {
  fullName: string;
  phone: string;
}): Promise<ProfileActionResult> {
  const fullName = input.fullName?.trim() ?? '';
  const phone = (input.phone ?? '').replace(/[\s-]/g, '');

  if (fullName.length < 2) {
    return { ok: false, error: 'يرجى إدخال الاسم الكامل.', field: 'fullName' };
  }
  if (!PHONE_RE.test(phone)) {
    return {
      ok: false,
      error: 'يرجى إدخال رقم جوال صحيح بصيغة دولية، مثال: +9665XXXXXXXX',
      field: 'phone',
    };
  }

  try {
    await authFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName, phone }),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
    }
    return { ok: false, error: 'تعذّر حفظ التغييرات حاليًا. حاول مرة أخرى بعد لحظات.' };
  }

  revalidatePath('/account/profile');
  return { ok: true };
}

/**
 * Mark one notification as read → PATCH /v1/me/notifications/:id/read.
 * Idempotent server-side (already-read is a no-op). Bound form action:
 * markNotificationReadAction.bind(null, id).
 */
export async function markNotificationReadAction(id: string): Promise<void> {
  try {
    await authFetch(`/me/notifications/${id}/read`, { method: 'PATCH' });
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    // Non-auth failure: leave as-is; revalidate re-renders current state.
  }
  revalidatePath('/account/notifications');
}

/** Mark all notifications as read → PATCH /v1/me/notifications/read-all. */
export async function markAllNotificationsReadAction(): Promise<void> {
  try {
    await authFetch('/me/notifications/read-all', { method: 'PATCH' });
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
  }
  revalidatePath('/account/notifications');
}

export type MaintenanceActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'unitId' | 'categoryId' | 'description' };

/**
 * Create a maintenance request → POST /v1/me/maintenance-requests. Sends a
 * single `categoryId` (the DTO accepts categoryId | categoryIds; single is the
 * simplest backend-compatible payload). Unit ownership is enforced by the
 * backend — we never trust the client. On success the caller navigates to the
 * list (which we revalidate here).
 */
export async function createMaintenanceRequestAction(input: {
  unitId: string;
  categoryId: string;
  description: string;
}): Promise<MaintenanceActionResult> {
  const unitId = input.unitId?.trim() ?? '';
  const categoryId = input.categoryId?.trim() ?? '';
  const description = input.description?.trim() ?? '';

  if (!unitId) return { ok: false, error: 'يرجى اختيار الوحدة.', field: 'unitId' };
  if (!categoryId) return { ok: false, error: 'يرجى اختيار فئة الصيانة.', field: 'categoryId' };
  if (description.length < 5) {
    return { ok: false, error: 'يرجى كتابة وصف للمشكلة لا يقل عن ٥ أحرف.', field: 'description' };
  }

  try {
    await authFetch('/me/maintenance-requests', {
      method: 'POST',
      body: JSON.stringify({ unitId, categoryId, description }),
    });
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
    return { ok: false, error: 'تعذّر إرسال الطلب حاليًا. حاول مرة أخرى بعد لحظات.' };
  }

  revalidatePath('/account/maintenance');
  return { ok: true };
}

/**
 * Remove one saved favorite → DELETE /v1/me/favorites/:id. The id is the
 * FAVORITE record's id (never a project/unit id). Non-optimistic: on failure
 * the item simply remains after revalidation. Designed to be used as a bound
 * form action: removeFavoriteAction.bind(null, favorite.id).
 */
export async function removeFavoriteAction(favoriteId: string): Promise<void> {
  try {
    await authFetch(`/me/favorites/${favoriteId}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    // Other errors: do nothing — the item stays visible after revalidate.
  }
  revalidatePath('/account/favorites');
}
