'use client';

import { useActionState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { AuthField, AuthMessage, AuthPasswordField, AuthSubmit } from '@/components/auth/auth-fields';
import { superAdminLoginAction, type SuperAdminLoginState } from './actions';

export default function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState<SuperAdminLoginState, FormData>(
    superAdminLoginAction,
    {},
  );

  return (
    <form action={action} className="space-y-6">
      <AuthField
        label="البريد الإلكتروني"
        icon={Mail}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="admin@platform.com"
        dir="ltr"
        className="text-right"
      />
      <AuthPasswordField
        label="كلمة المرور"
        icon={Lock}
        name="password"
        required
        autoComplete="current-password"
        placeholder="••••••••••"
      />

      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthSubmit pending={pending} pendingLabel="جاري تسجيل الدخول…">
        دخول المنصة
      </AuthSubmit>
    </form>
  );
}
