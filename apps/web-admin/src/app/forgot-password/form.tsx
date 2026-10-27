'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Mail } from 'lucide-react';
import { AUTH_LINK, AuthField, AuthMessage, AuthSubmit } from '@/components/auth/auth-fields';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="space-y-6">
        <AuthMessage tone="success">
          إذا كان البريد مسجّلًا لدينا، ستصلك رسالة برابط إعادة التعيين خلال دقائق. تحقق من صندوق الوارد أو مجلد البريد غير المرغوب فيه.
        </AuthMessage>
        <p className="text-center">
          <Link href="/login" className={AUTH_LINK}>
            العودة إلى تسجيل الدخول
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <AuthField
        label="البريد الإلكتروني"
        icon={Mail}
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="name@company.com"
        dir="ltr"
        className="text-right"
      />

      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}

      <AuthSubmit pending={pending} pendingLabel="جارٍ الإرسال…">
        إرسال رابط إعادة التعيين
      </AuthSubmit>

      <p className="text-center">
        <Link href="/login" className={AUTH_LINK}>
          العودة إلى تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}
