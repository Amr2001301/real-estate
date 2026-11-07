'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPasswordAction } from '@/lib/auth-actions';
import { routes } from '@/lib/routes';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

export function ResetPasswordCard({ token, locale = 'ar' }: { token: string; locale?: Locale }) {
  const t = authT(locale);
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [topError, setTopError] = useState('');

  if (!token) {
    return (
      <PremiumCard className="p-6 sm:p-8">
        <InlineNotice tone="error">
          {t.reset.invalidBefore}{' '}
          <a href={routes.forgotPassword} className="underline underline-offset-4">{t.reset.forgotLink}</a>.
        </InlineNotice>
      </PremiumCard>
    );
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (newPassword.length < 8) e.newPassword = t.common.passwordMin;
    if (confirm !== newPassword) e.confirm = t.common.passwordMismatch;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setTopError('');
    if (!validate()) return;

    setPending(true);
    const res = await resetPasswordAction({ token, newPassword });
    setPending(false);

    if (res.ok) {
      router.push(`${routes.login}?reset=1`);
      return;
    }

    if (res.status === 0) {
      setTopError(t.common.offline);
    } else if (res.status === 400) {
      setTopError(t.reset.invalidShort);
    } else {
      setTopError(t.common.genericError);
    }
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label={t.reset.newPassword} required>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            invalid={!!errors.newPassword}
            placeholder={t.register.passwordHint}
            autoComplete="new-password"
            autoFocus
          />
          <FormError>{errors.newPassword}</FormError>
        </Field>

        <Field label={t.register.confirmLabel} required>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!errors.confirm}
            placeholder={t.register.confirmHint}
            autoComplete="new-password"
          />
          <FormError>{errors.confirm}</FormError>
        </Field>

        {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t.reset.saving : t.reset.submit}
        </Button>
      </form>
    </PremiumCard>
  );
}
