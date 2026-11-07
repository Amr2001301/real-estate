'use client';

import { useState } from 'react';
import { CustomerAuthForm } from './CustomerAuthForm';
import { OtpAuthForm } from './OtpAuthForm';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

/**
 * Login is email/password by default; a secondary link reveals the existing
 * phone-OTP flow (kept available, not removed).
 */
export function LoginCard({ locale = 'ar' }: { locale?: Locale }) {
  const t = authT(locale);
  const [method, setMethod] = useState<'password' | 'otp'>('password');

  if (method === 'otp') {
    return (
      <div className="space-y-4">
        <OtpAuthForm mode="login" locale={locale} />
        <button
          type="button"
          onClick={() => setMethod('password')}
          className="block w-full text-center text-sm text-ink-muted transition-colors hover:text-ink-strong"
        >
          {t.login.useEmail}
        </button>
      </div>
    );
  }

  return <CustomerAuthForm mode="login" onUseOtp={() => setMethod('otp')} locale={locale} />;
}
