'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Mail, Lock, Building2 } from 'lucide-react';
import { AUTH_LINK, AuthField, AuthMessage, AuthPasswordField, AuthSubmit } from '@/components/auth/auth-fields';
import { loginAction, type LoginState } from './actions';

export default function LoginForm({ from, lastCompanySlug }: { from?: string; lastCompanySlug?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-6">
      {from ? <input type="hidden" name="from" value={from} /> : null}

      <AuthField
        label="كود الشركة"
        icon={Building2}
        name="slug"
        type="text"
        required
        autoComplete="organization"
        defaultValue={lastCompanySlug}
        placeholder="your-company"
        dir="ltr"
        className="text-right"
      />
      <AuthField
        label="البريد الإلكتروني"
        icon={Mail}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="name@company.com"
        dir="ltr"
        className="text-right"
      />
      <div className="space-y-3">
        <AuthPasswordField
          label="كلمة المرور"
          icon={Lock}
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••••"
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className={AUTH_LINK}>
            نسيت كلمة المرور؟
          </Link>
        </div>
      </div>

      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthSubmit pending={pending} pendingLabel="جاري تسجيل الدخول…">
        تسجيل الدخول
      </AuthSubmit>
    </form>
  );
}
