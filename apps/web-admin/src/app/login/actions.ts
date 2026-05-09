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

  redirect('/dashboard');
}

export async function logoutAction() {
  const c = await cookies();
  c.delete('access_token');
  c.delete('refresh_token');
  c.delete('user');
  redirect('/login');
}
