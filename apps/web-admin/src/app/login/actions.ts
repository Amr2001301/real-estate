'use server';

import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { loginStaff, ApiError, API_BASE, isTwoFactorStep } from '@/lib/api';
import { holdChallenge, homeFor, setSessionCookies } from '@/lib/auth-session';

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
    unstable_rethrow(e);
    if (e instanceof ApiError) {
      if (e.status === 404) return { error: 'الشركة غير موجودة — تحقق من كود الشركة' };
      if (e.status === 401) return { error: 'بيانات الدخول غير صحيحة' };
      if (e.status === 403) return { error: 'الحساب غير نشط أو تم إيقاف الاشتراك' };
      if (e.status === 429) return { error: 'محاولات كثيرة — حاول بعد دقيقة' };
    }
    const msg = (e as Error).message ?? '';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return { error: 'تعذر الاتصال بالخادم — تأكد أن الـ API يعمل على ' + (process.env.API_BASE_URL ?? 'http://localhost:4000') };
    }
    return { error: 'حدث خطأ غير متوقع' };
  }

  const from = String(formData.get('from') ?? '');
  // UX-only: remember slug for the next login pre-fill. Not authorization state.
  (await cookies()).set('last_company_slug', slug, {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90,
  });

  // TFA1 — the account has two-step sign-in (or must set it up): the code comes next.
  if (isTwoFactorStep(result)) {
    await holdChallenge(result, from);
    redirect(result.twoFactorSetupRequired ? '/login/two-factor/setup' : '/login/two-factor');
  }

  await setSessionCookies(result);
  redirect(homeFor(result.user.role, from));
}

export async function logoutAction() {
  const c = await cookies();
  // SES1 — end the session on the server too, so it leaves «الأجهزة المتصلة»
  // and its tokens stop working; best effort, the cookies go either way.
  const refreshToken = c.get('refresh_token')?.value;
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // the API being down must not keep anyone signed in here
    }
  }
  c.delete('access_token');
  c.delete('refresh_token');
  c.delete('user');
  // Do NOT delete last_company_slug — it's UX convenience state, not session state.
  redirect('/login');
}
