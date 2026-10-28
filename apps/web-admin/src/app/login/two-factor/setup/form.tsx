'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AUTH_BUTTON, AuthField, AuthMessage, AuthSubmit } from '@/components/auth/auth-fields';
import { QrCode } from '@/components/security/qr-code';
import { finishTwoFactorSetupAction, startTwoFactorSetupAction, type SetupFinish, type SetupStart } from '../actions';

export default function TwoFactorSetupForm() {
  const [start, setStart] = useState<SetupStart | null>(null);
  const [state, action, pending] = useActionState<SetupFinish, FormData>(finishTwoFactorSetupAction, {});
  // Once: each call makes a new secret, and the one on screen must be the one kept
  // (React runs effects twice in development).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startTwoFactorSetupAction().then(setStart);
  }, []);

  if (state.recoveryCodes) {
    return (
      <div className="space-y-5" data-testid="recovery-codes">
        <AuthMessage tone="success">تم تفعيل التحقق بخطوتين.</AuthMessage>
        <p className="text-[13.5px] leading-relaxed text-[#C9CFDA]">
          احتفظ بالأكواد الاحتياطية دي في مكان آمن. كل كود يشتغل مرة واحدة لو موبايلك مش معاك. مش هتظهر تاني.
        </p>
        <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] p-4 font-mono text-[14px] text-[#F4EFE6]">
          {state.recoveryCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <a href={state.next ?? '/dashboard'} className={AUTH_BUTTON}>حفظتها — متابعة</a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6" data-testid="two-factor-setup">
      {!start ? (
        <p className="text-[13px] text-[#C9CFDA]">جاري التحضير…</p>
      ) : start.error ? (
        <AuthMessage tone="error">{start.error}</AuthMessage>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1.5 ps-5 text-[13.5px] text-[#C9CFDA]">
            <li>نزّل تطبيق مصادقة (Google Authenticator أو Microsoft Authenticator).</li>
            <li>امسح الكود ده من التطبيق، أو اكتب المفتاح يدويًا.</li>
            <li>اكتب الكود اللي هيظهر في التطبيق.</li>
          </ol>
          <div className="flex flex-col items-center gap-3">
            <QrCode value={start.otpauthUrl!} label="رمز QR لتطبيق المصادقة" />
            <code dir="ltr" data-testid="totp-secret" className="select-all break-all rounded-lg bg-white/[0.05] px-3 py-1.5 text-[13px] text-[#F4EFE6]">{start.secret}</code>
          </div>
        </div>
      )}
      <AuthField label="الكود من التطبيق" icon={ShieldCheck} name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" placeholder="000000" dir="ltr" className="text-right tracking-[0.3em]" />
      {state.error && <AuthMessage tone="error">{state.error}</AuthMessage>}
      <AuthSubmit pending={pending} pendingLabel="جاري التفعيل…">
        تفعيل ومتابعة
      </AuthSubmit>
    </form>
  );
}
