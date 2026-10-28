'use client';

import { useActionState, useState } from 'react';
import type { Locale } from '@/lib/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { changePasswordAction, type PasswordState } from '@/lib/security-actions';
import { securityT } from './security-messages';

export function ChangePasswordForm({ locale }: { locale: Locale }) {
  const m = securityT(locale);
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  // Checked here too: a submitted form is cleared, and retyping three passwords for a typo is a chore.
  const [local, setLocal] = useState<string | null>(null);
  const check = (e: React.FormEvent<HTMLFormElement>) => {
    const f = new FormData(e.currentTarget);
    const next = String(f.get('newPassword') ?? '');
    const error = next.length < 8 ? m.tooShort : next !== String(f.get('confirmPassword') ?? '') ? m.mismatch : null;
    setLocal(error);
    if (error) e.preventDefault();
  };
  const error = local ?? state.error;
  return (
    <form action={action} onSubmit={check} className="grid max-w-md gap-3" data-testid="change-password-form">
      <p className="text-[12.5px] text-slate-500">{m.passwordHint}</p>
      {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name) => (
        <label key={name} className="grid gap-1 text-[12.5px] font-semibold text-slate-600">
          {m[name]}
          <Input type="password" name={name} required minLength={name === 'currentPassword' ? 1 : 8} autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} />
        </label>
      ))}
      {error && <p role="alert" className="text-[12.5px] font-semibold text-danger-600">{error}</p>}
      {state.ok && !local && <p role="status" className="text-[12.5px] font-semibold text-emerald-700">{m.saved}</p>}
      <div>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>{m.save}</Button>
      </div>
    </form>
  );
}
