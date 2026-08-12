'use server';

import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export interface ResetPasswordState {
  error?: string;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get('token') ?? '').trim();
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!token) return { error: 'رابط إعادة التعيين غير صالح.' };
  if (newPassword.length < 8) return { error: 'كلمة المرور يجب ألا تقل عن ٨ أحرف.' };
  if (newPassword !== confirm) return { error: 'كلمتا المرور غير متطابقتين.' };

  try {
    const res = await fetch(`${API_BASE}/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status >= 500) return { error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' };
      return { error: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.' };
    }
  } catch {
    return { error: 'تعذر الاتصال بالخادم. تأكد أن الـ API يعمل.' };
  }

  redirect('/login?reset=1');
}
