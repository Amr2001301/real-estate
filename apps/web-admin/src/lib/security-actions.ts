'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { securityT } from '@/components/security/security-messages';

/* SES1 — the caller's own sessions and password, and an admin signing a staff member out everywhere. */

const refresh = () => {
  revalidatePath('/dashboard/security');
  revalidatePath('/portal/security');
};

export async function revokeSessionAction(id: string) {
  await api.delete(`/auth/sessions/${id}`);
  refresh();
}

export async function revokeOtherSessionsAction() {
  await api.post('/auth/sessions/revoke-others');
  refresh();
}

export async function signOutUserEverywhereAction(userId: string) {
  await api.post(`/users/${userId}/sessions/revoke`);
  revalidatePath(`/dashboard/users/${userId}/sessions`);
}

export interface PasswordState {
  ok?: boolean;
  error?: string;
}

export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const m = securityT(await getLocale());
  const currentPassword = String(form.get('currentPassword') ?? '');
  const newPassword = String(form.get('newPassword') ?? '');
  if (newPassword.length < 8) return { error: m.tooShort };
  if (newPassword !== String(form.get('confirmPassword') ?? '')) return { error: m.mismatch };
  try {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      if (/incorrect/i.test(e.rawMessage)) return { error: m.wrongCurrent };
      if (/different/i.test(e.rawMessage)) return { error: m.sameAsOld };
    }
    return { error: `${m.failed}: ${(e as Error).message}` };
  }
  refresh();
  return { ok: true };
}
