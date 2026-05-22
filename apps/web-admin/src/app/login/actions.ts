'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { login } from '@/lib/api';

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  let result;
  try {
    result = await login(email, password);
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return { error: 'تعذر الاتصال بالخادم — تأكد أن الـ API يعمل على ' + (process.env.API_BASE_URL ?? 'http://localhost:4000') };
    }
    if (msg.includes('401')) return { error: 'بيانات الدخول غير صحيحة' };
    return { error: msg || 'حدث خطأ غير متوقع' };
  }

  const c = await cookies();
  c.set('access_token', result.tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: result.tokens.expiresIn,
  });
  c.set('refresh_token', result.tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  c.set(
    'user',
    JSON.stringify({
      id: result.user.id,
      role: result.user.role,
      fullName: result.user.fullName,
    }),
    {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  );

  const from = String(formData.get('from') ?? '');
  redirect(safeFromForRole(from, result.user.role));
}

/**
 * Pick a post-login destination that honors the `from` query the middleware
 * recorded — but only when it points to an allow-listed internal path that is
 * compatible with the user's role. Anything else falls back to the role's
 * default workspace.
 *
 * Rules (defence in depth — first failure picks the default):
 *   1. Must start with a single '/'                  → reject '//evil.com'
 *   2. Must not start with '/\' (browser normalises) → reject '/\evil.com'
 *   3. Path root (before any ? or #) must be /dashboard or /portal
 *   4. BROKER may only land in /portal; everyone else may only land in /dashboard
 */
function safeFromForRole(from: string, role: string): string {
  // Maintenance supervisors are mobile-only — never honor a /dashboard `from`.
  if (role === 'MAINTENANCE_SUPERVISOR') return '/maintenance-app';

  const fallback = role === 'BROKER' ? '/portal' : '/dashboard';

  if (!from || from.length > 2048) return fallback;
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;

  const pathOnly = from.split(/[?#]/, 1)[0] ?? '';
  const allowedRoot = role === 'BROKER' ? '/portal' : '/dashboard';
  const matchesAllowedRoot =
    pathOnly === allowedRoot || pathOnly.startsWith(`${allowedRoot}/`);

  return matchesAllowedRoot ? from : fallback;
}

export async function logoutAction() {
  const c = await cookies();
  c.delete('access_token');
  c.delete('refresh_token');
  c.delete('user');
  redirect('/login');
}
