'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { AUTH_LINK, AuthField, AuthMessage, AuthSubmit } from '@/components/auth/auth-fields';
import { verifyTwoFactorAction, type TwoFactorState } from './actions';

export default function TwoFactorForm() {
  const [state, action, pending] = useActionState<TwoFactorState, FormData>(verifyTwoFactorAction, {});
  const [recovery, setRecovery] = useState(false);
  return (
    <form action={action} className="space-y-6" data-testid="two-factor-form">
      {recovery ? (
        <AuthField key="recovery" label="كود احتياطي" icon={KeyRound} name="code" type="text" required autoComplete="off" placeholder="xxxx-xxxx" dir="ltr" className="text-right" />
      ) : (
        <AuthField
          key="totp"
          label="الكود من تطبيق المصادقة"
          icon={ShieldCheck}
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          placeholder="000000"
          dir="ltr"
          className="text-right tracking-[0.3em]"
        />
      )}
      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}
      <AuthSubmit pending={pending} pendingLabel="جاري التحقق…">
        تأكيد
      </AuthSubmit>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setRecovery((r) => !r)} className={AUTH_LINK}>
          {recovery ? 'استخدم الكود من التطبيق' : 'معاك كود احتياطي بدل التطبيق؟'}
        </button>
        <Link href="/login" className={AUTH_LINK}>رجوع</Link>
      </div>
    </form>
  );
}
