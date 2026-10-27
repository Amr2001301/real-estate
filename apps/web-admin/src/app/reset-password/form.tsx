'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Lock } from 'lucide-react';
import { AUTH_BUTTON, AuthMessage, AuthPasswordField, AuthSubmit } from '@/components/auth/auth-fields';
import { resetPasswordAction, type ResetPasswordState } from './actions';

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );

  if (!token) {
    return (
      <div className="space-y-6">
        <AuthMessage tone="error">رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.</AuthMessage>
        <Link href="/forgot-password" className={AUTH_BUTTON}>
          طلب رابط جديد
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      <AuthPasswordField
        label="كلمة المرور الجديدة"
        icon={Lock}
        name="newPassword"
        required
        autoComplete="new-password"
        autoFocus
        placeholder="٨ أحرف على الأقل"
        minLength={8}
      />
      <AuthPasswordField
        label="تأكيد كلمة المرور"
        icon={Lock}
        name="confirm"
        required
        autoComplete="new-password"
        placeholder="أعد إدخال كلمة المرور"
      />

      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthSubmit pending={pending} pendingLabel="جارٍ الحفظ…">
        تعيين كلمة المرور الجديدة
      </AuthSubmit>
    </form>
  );
}
