'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { ApiError, authPost, type AuthResult } from '@/lib/api';
import { heldChallenge, homeFor, setSessionCookies } from '@/lib/auth-session';

/* TFA1 — the second sign-in step: a code from the authenticator app, or setting it up. */

export interface TwoFactorState {
  error?: string;
}

function refusal(e: unknown): string {
  if (e instanceof ApiError) {
    const code = (e.payload as { code?: string } | undefined)?.code;
    if (code === 'TWO_FACTOR_LOCKED' || e.status === 429) return 'محاولات خاطئة كثيرة — حاول بعد 15 دقيقة';
    if (code === 'TWO_FACTOR_INVALID' || e.status === 401 || e.status === 400) return 'الكود غير صحيح — تأكد من الكود الحالي في التطبيق';
    if (e.status === 403) return 'الحساب غير نشط أو تم إيقاف الاشتراك';
  }
  return 'حدث خطأ غير متوقع';
}

function expired(e: unknown): boolean {
  return e instanceof ApiError && (e.payload as { code?: string } | undefined)?.code === 'CHALLENGE_EXPIRED';
}

export async function verifyTwoFactorAction(_prev: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const { challenge, from } = await heldChallenge();
  if (!challenge) redirect('/login?expired=1');
  const code = String(form.get('code') ?? '').trim();
  if (!code) return { error: 'اكتب الكود' };
  let result: AuthResult;
  try {
    result = await authPost<AuthResult>('/auth/2fa/verify', { challenge, code });
  } catch (e) {
    unstable_rethrow(e);
    if (expired(e)) redirect('/login?expired=1');
    return { error: refusal(e) };
  }
  await setSessionCookies(result);
  redirect(homeFor(result.user.role, from));
}

export interface SetupStart {
  secret?: string;
  otpauthUrl?: string;
  error?: string;
}

/** The secret to scan. Each call starts afresh (the page calls it once). */
export async function startTwoFactorSetupAction(): Promise<SetupStart> {
  const { challenge } = await heldChallenge();
  if (!challenge) redirect('/login?expired=1');
  try {
    return await authPost<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup-challenge', { challenge });
  } catch (e) {
    unstable_rethrow(e);
    if (expired(e)) redirect('/login?expired=1');
    return { error: refusal(e) };
  }
}

export interface SetupFinish {
  error?: string;
  recoveryCodes?: string[];
  next?: string;
}

/** The first code turns it on and signs in; the recovery codes are shown once, before going on. */
export async function finishTwoFactorSetupAction(_prev: SetupFinish, form: FormData): Promise<SetupFinish> {
  const { challenge, from } = await heldChallenge();
  if (!challenge) redirect('/login?expired=1');
  const code = String(form.get('code') ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { error: 'اكتب الكود المكوّن من 6 أرقام' };
  try {
    const result = await authPost<AuthResult & { recoveryCodes: string[] }>('/auth/2fa/enable-challenge', { challenge, code });
    await setSessionCookies(result);
    return { recoveryCodes: result.recoveryCodes, next: homeFor(result.user.role, from) };
  } catch (e) {
    unstable_rethrow(e);
    if (expired(e)) redirect('/login?expired=1');
    return { error: refusal(e) };
  }
}
