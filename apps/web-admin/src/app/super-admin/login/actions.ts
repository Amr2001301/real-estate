'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginSuperAdmin, ApiError } from '@/lib/api';

export interface SuperAdminLoginState {
  error?: string;
}

export async function superAdminLoginAction(
  _prev: SuperAdminLoginState,
  formData: FormData,
): Promise<SuperAdminLoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' };

  let result;
  try {
    result = await loginSuperAdmin(email, password);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return { error: 'بيانات الدخول غير صحيحة' };
    }
    const msg = (e as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return { error: 'تعذر الاتصال بالخادم — تأكد أن الـ API يعمل' };
    }
    return { error: 'حدث خطأ غير متوقع' };
  }

  // Reject non-SUPER_ADMIN in case the endpoint ever returns a different role
  // (defence-in-depth; backend should already enforce this).
  if (result.user.role !== 'SUPER_ADMIN') {
    return { error: 'بيانات الدخول غير صحيحة' };
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

  redirect('/dashboard/super-admin');
}
