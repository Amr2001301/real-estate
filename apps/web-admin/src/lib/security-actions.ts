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

// ── TFA1 — own two-step sign-in, the company rule, and the admin's reset ─────

export interface TwoFactorResult {
  ok?: boolean;
  error?: string;
  recoveryCodes?: string[];
  secret?: string;
  otpauthUrl?: string;
}

async function tfaError(e: unknown): Promise<string> {
  const m = securityT(await getLocale());
  if (e instanceof ApiError) {
    if (e.status === 400 && /password/i.test(e.rawMessage)) return m.wrongCurrent;
    if (e.status === 400 || e.status === 401) return m.tfaWrongCode;
    if (e.status === 429) return e.rawMessage;
  }
  return `${m.failed}: ${(e as Error).message}`;
}

export async function startOwnTwoFactorAction(): Promise<TwoFactorResult> {
  try {
    return await api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup');
  } catch (e) {
    return { error: await tfaError(e) };
  }
}

export async function enableOwnTwoFactorAction(_prev: TwoFactorResult, form: FormData): Promise<TwoFactorResult> {
  try {
    const r = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code: String(form.get('code') ?? '').trim() });
    refresh();
    return { ok: true, recoveryCodes: r.recoveryCodes };
  } catch (e) {
    return { error: await tfaError(e) };
  }
}

export async function newRecoveryCodesAction(_prev: TwoFactorResult, form: FormData): Promise<TwoFactorResult> {
  try {
    const r = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code: String(form.get('code') ?? '').trim() });
    refresh();
    return { ok: true, recoveryCodes: r.recoveryCodes };
  } catch (e) {
    return { error: await tfaError(e) };
  }
}

export async function disableOwnTwoFactorAction(_prev: TwoFactorResult, form: FormData): Promise<TwoFactorResult> {
  try {
    await api.post('/auth/2fa/disable', { password: String(form.get('password') ?? ''), code: String(form.get('code') ?? '').trim() });
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: await tfaError(e) };
  }
}

export async function setTwoFactorPolicyAction(_prev: TwoFactorResult, form: FormData): Promise<TwoFactorResult> {
  try {
    await api.put('/auth/2fa/policy', { mode: String(form.get('mode') ?? 'OFF') });
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: await tfaError(e) };
  }
}

export async function resetUserTwoFactorAction(userId: string) {
  await api.post(`/users/${userId}/2fa/reset`);
  revalidatePath(`/dashboard/users/${userId}/sessions`);
}
