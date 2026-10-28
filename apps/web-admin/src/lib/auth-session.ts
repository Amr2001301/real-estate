import { cookies } from 'next/headers';
import type { AuthResult, TwoFactorStep } from '@/lib/api';

/* The cookies a sign-in leaves, and (TFA1) the short-lived second-step challenge. */

const CHALLENGE_COOKIE = 'tfa_challenge';
const FROM_COOKIE = 'tfa_from';

export async function setSessionCookies(result: AuthResult) {
  const c = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  c.set('access_token', result.tokens.accessToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: result.tokens.expiresIn,
  });
  c.set('refresh_token', result.tokens.refreshToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  c.set('user', JSON.stringify({ id: result.user.id, role: result.user.role, fullName: result.user.fullName }), {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  c.delete(CHALLENGE_COOKIE);
  c.delete(FROM_COOKIE);
}

/** Remember the challenge (httpOnly, five minutes — as long as it lives) and where to go after. */
export async function holdChallenge(step: TwoFactorStep, from: string) {
  const c = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  c.set(CHALLENGE_COOKIE, step.challenge, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 5 * 60 });
  c.set(FROM_COOKIE, from.slice(0, 2048), { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 5 * 60 });
}

export async function heldChallenge(): Promise<{ challenge: string | null; from: string }> {
  const c = await cookies();
  return { challenge: c.get(CHALLENGE_COOKIE)?.value ?? null, from: c.get(FROM_COOKIE)?.value ?? '' };
}

/**
 * Where a signed-in user lands: the `from` the proxy recorded when it is an
 * internal path for their role, else their workspace.
 */
export function homeFor(role: string, from = ''): string {
  if (role === 'MAINTENANCE_SUPERVISOR') return '/maintenance-app';
  if (role === 'SUPER_ADMIN') return '/dashboard/super-admin';

  const fallback = role === 'BROKER' ? '/portal' : '/dashboard';

  if (!from || from.length > 2048) return fallback;
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;

  const pathOnly = from.split(/[?#]/, 1)[0] ?? '';
  const allowedRoot = role === 'BROKER' ? '/portal' : '/dashboard';
  const matchesAllowedRoot = pathOnly === allowedRoot || pathOnly.startsWith(`${allowedRoot}/`);

  return matchesAllowedRoot ? from : fallback;
}
