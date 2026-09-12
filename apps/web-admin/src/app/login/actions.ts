'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginStaff, ApiError } from '@/lib/api';

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!slug) return { error: 'يرجى إدخال كود الشركة' };
  if (!email || !password) return { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' };

  let result;
  try {
    result = await loginStaff(slug, email, password);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) return { error: 'الشركة غير موجودة — تحقق من كود الشركة' };
      if (e.status === 401) return { error: 'بيانات الدخول غير صحيحة' };
      if (e.status === 403) return { error: 'الحساب غير نشط أو تم إيقاف الاشتراك' };
    }
    const msg = (e as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return { error: 'تعذر الاتصال بالخادم — تأكد أن الـ API يعمل على ' + (process.env.API_BASE_URL ?? 'http://localhost:4000') };
    }
    return { error: 'حدث خطأ غير متوقع' };
  }

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
  // UX-only: remember slug for the next login pre-fill. Not authorization state.
  c.set('last_company_slug', slug, {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90,
  });

  const from = String(formData.get('from') ?? '');
  redirect(safeFromForRole(from, result.user.role));
}

/**
 * Pick a post-login destination that honors the `from` query the middleware
 * recorded — but only when it points to an allow-listed internal path that is
 * compatible with the user's role. Anything else falls back to the role's
 * default workspace.
 */
function safeFromForRole(from: string, role: string): string {
  if (role === 'MAINTENANCE_SUPERVISOR') return '/maintenance-app';

  const fallback = role === 'BROKER' ? '/portal' : '/dashboard';

  if (!from || from.length > 2048) return fallback;
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;

  const pathOnly = from.split(/[?#]/, 1)[0] ?? '';
  const allowedRoot = role === 'BROKER' ? '/portal' : '/dashboard';
  const matchesAllowedRoot = pathOnly === allowedRoot || pathOnly.startsWith(`${allowedRoot}/`);

  return matchesAllowedRoot ? from : fallback;
}

export async function logoutAction() {
  const c = await cookies();
  c.delete('access_token');
  c.delete('refresh_token');
  c.delete('user');
  // Do NOT delete last_company_slug — it's UX convenience state, not session state.
  redirect('/login');
}
