'use server';

import { API_BASE } from '@/lib/api';

export interface ForgotPasswordState {
  sent?: boolean;
  error?: string;
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'البريد الإلكتروني مطلوب.' };

  try {
    const res = await fetch(`${API_BASE}/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    if (res.status === 0 || !res.ok && res.status >= 500) {
      return { error: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' };
    }
    // Always show success to avoid user enumeration.
    return { sent: true };
  } catch {
    return { error: 'تعذر الاتصال بالخادم. تأكد أن الـ API يعمل.' };
  }
}
