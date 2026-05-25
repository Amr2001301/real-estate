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
