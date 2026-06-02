'use server';

/**
 * Server actions for the authenticated /account portal. These run on the
 * server and call the backend via authFetch (Bearer from the httpOnly cookie;
 * refresh-on-401 works here because cookie writes are allowed in actions).
 * Tokens never reach client JS.
 */

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authFetch, AuthError, refreshSession } from '@/lib/api-auth';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_MAX_COUNT = 5;

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'fullName' | 'phone' };

export type AvatarActionResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; error: string };

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'currentPassword' | 'newPassword' };

/**
 * Upload a new avatar → POST /v1/users/me/avatar (multipart). The client passes
 * a FormData with a `file`; we re-validate type/size server-side (cheap, and
 * the backend enforces it too) then forward the multipart body via authFetch,
 * which omits Content-Type so fetch sets the multipart boundary itself.
 */
export async function uploadAvatarAction(formData: FormData): Promise<AvatarActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'لم يتم اختيار صورة.' };
  }
  if (!AVATAR_TYPES.includes(file.type)) {
    return { ok: false, error: 'صيغة غير مدعومة — استخدم JPG أو PNG أو WEBP.' };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'حجم الصورة كبير — الحد الأقصى ٥ ميجابايت.' };
  }

  const body = new FormData();
  body.append('file', file, file.name || 'avatar');

  try {
    const user = await authFetch<{ avatarUrl: string | null }>('/users/me/avatar', {
      method: 'POST',
      body,
    });
    if (!user?.avatarUrl) return { ok: false, error: 'تعذّر حفظ الصورة حاليًا. حاول مرة أخرى.' };
    revalidatePath('/account/profile');
    revalidatePath('/account');
    return { ok: true, avatarUrl: user.avatarUrl };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
    return { ok: false, error: 'تعذّر رفع الصورة حاليًا. حاول مرة أخرى بعد لحظات.' };
  }
}

/**
 * Change the signed-in user's password → POST /v1/auth/change-password.
 *
 * This deliberately bypasses authFetch's opaque error handling: the endpoint
 * returns 400 with a specific message for a wrong current password (vs. 401 =
 * a genuinely expired session), and we need to map those to distinct, field-
 * level Arabic messages. We still honour the session-refresh-once contract for
 * a real 401 by reusing refreshSession().
 */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const currentPassword = input.currentPassword ?? '';
  const newPassword = input.newPassword ?? '';
  if (!currentPassword) {
    return { ok: false, error: 'يرجى إدخال كلمة المرور الحالية.', field: 'currentPassword' };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'كلمة المرور الجديدة يجب ألا تقل عن ٨ أحرف.', field: 'newPassword' };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.', field: 'newPassword' };
  }

  async function post(): Promise<Response> {
    const c = await cookies();
    const token = c.get('access_token')?.value;
    return fetch(`${API_BASE}/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: 'no-store',
    });
  }

  let res: Response;
  try {
    res = await post();
    if (res.status === 401) {
      // Genuine session expiry — refresh once, then retry.
      const refreshed = await refreshSession();
      if (!refreshed) return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
      res = await post();
    }
  } catch {
    return { ok: false, error: 'تعذّر الاتصال بالخادم. حاول مرة أخرى بعد لحظات.' };
  }

  if (res.ok) {
    return { ok: true };
  }

  // Map backend validation messages to field-level Arabic copy.
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const raw = Array.isArray(data?.message) ? data?.message[0] : data?.message;
  const msg = typeof raw === 'string' ? raw : '';

  if (msg === 'Current password is incorrect') {
    return { ok: false, error: 'كلمة المرور الحالية غير صحيحة.', field: 'currentPassword' };
  }
  if (msg === 'New password must be different from the current one') {
    return { ok: false, error: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.', field: 'newPassword' };
  }
  if (msg === 'No password is set for this account') {
    return { ok: false, error: 'لا توجد كلمة مرور مرتبطة بهذا الحساب.' };
  }
  return { ok: false, error: 'تعذّر تغيير كلمة المرور حاليًا. حاول مرة أخرى بعد لحظات.' };
}

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
 * Create a maintenance request → POST /v1/me/maintenance-requests (multipart).
 * Accepts a FormData carrying the text fields + an optional `attachments` field
 * (≤5 images/PDFs, ≤5 MB each). We re-validate everything server-side, then
 * forward the multipart body via authFetch (which omits Content-Type so fetch
 * sets the boundary). The backend streams each file to storage and logs it as a
 * customer-visible Document on the new request. Unit ownership is enforced by
 * the backend — we never trust the client.
 */
export async function createMaintenanceRequestAction(formData: FormData): Promise<MaintenanceActionResult> {
  const unitId = ((formData.get('unitId') as string) ?? '').trim();
  const categoryId = ((formData.get('categoryId') as string) ?? '').trim();
  const description = ((formData.get('description') as string) ?? '').trim();

  if (!unitId) return { ok: false, error: 'يرجى اختيار الوحدة.', field: 'unitId' };
  if (!categoryId) return { ok: false, error: 'يرجى اختيار فئة الصيانة.', field: 'categoryId' };
  if (description.length < 5) {
    return { ok: false, error: 'يرجى كتابة وصف للمشكلة لا يقل عن ٥ أحرف.', field: 'description' };
  }

  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > ATTACH_MAX_COUNT) {
    return { ok: false, error: 'يمكن إرفاق ٥ ملفات كحد أقصى.' };
  }
  for (const f of files) {
    if (!ATTACH_TYPES.includes(f.type)) {
      return { ok: false, error: 'صيغة غير مدعومة — استخدم JPG أو PNG أو WEBP أو PDF.' };
    }
    if (f.size > ATTACH_MAX_BYTES) {
      return { ok: false, error: `الملف "${f.name}" كبير — الحد الأقصى ٥ ميجابايت.` };
    }
  }

  const body = new FormData();
  body.append('unitId', unitId);
  body.append('categoryId', categoryId);
  body.append('description', description);
  files.forEach((f) => body.append('attachments', f, f.name));

  try {
    await authFetch('/me/maintenance-requests', { method: 'POST', body });
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

// ─── Two-sided visit confirmation (P2) ───────────────────────────────────

export type VisitActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Customer confirms an admin-proposed appointment → POST
 * /v1/me/visit-appointments/:id/confirm. Backend enforces ownership (404 for
 * cross-account access) and state (only SCHEDULED → CONFIRMED). Errors are
 * mapped to friendly Arabic; raw backend detail never reaches the UI.
 */
export async function confirmVisitAppointmentAction(
  appointmentId: string,
): Promise<VisitActionResult> {
  try {
    await authFetch(`/me/visit-appointments/${appointmentId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
    }
    return { ok: false, error: 'تعذّر تأكيد الزيارة حاليًا. حاول مرة أخرى بعد لحظات.' };
  }
  revalidatePath('/account/visits');
  return { ok: true };
}

/**
 * Customer asks to reschedule an admin-proposed appointment → POST
 * /v1/me/visit-appointments/:id/request-reschedule. Optional reason flows
 * through to the backend, where it's stored on the appointment and the
 * VisitActivity audit row. Ownership + state guards match the confirm action.
 */
export async function requestVisitRescheduleAction(
  appointmentId: string,
  reason: string,
): Promise<VisitActionResult> {
  const trimmed = (reason ?? '').trim().slice(0, 500);
  try {
    await authFetch(`/me/visit-appointments/${appointmentId}/request-reschedule`, {
      method: 'POST',
      body: JSON.stringify({ reason: trimmed || undefined }),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.' };
    }
    return {
      ok: false,
      error: 'تعذّر إرسال طلب إعادة الجدولة حاليًا. حاول مرة أخرى بعد لحظات.',
    };
  }
  revalidatePath('/account/visits');
  return { ok: true };
}
