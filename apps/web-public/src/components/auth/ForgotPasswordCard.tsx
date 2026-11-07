'use client';

import { useState } from 'react';
import { forgotPasswordAction } from '@/lib/auth-actions';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';
import { authT } from '@/messages/auth';
import type { Locale } from '@/lib/locale';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordCard({ locale = 'ar' }: { locale?: Locale }) {
  const t = authT(locale);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [topError, setTopError] = useState('');

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setEmailError('');
    setTopError('');

    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setEmailError(t.common.emailInvalid);
      return;
    }

    setPending(true);
    const res = await forgotPasswordAction({ email: email.trim() });
    setPending(false);

    if (res.status === 0) {
      setTopError(t.common.offline);
      return;
    }
    // Always show success to avoid user enumeration.
    setSent(true);
  }

  if (sent) {
    return (
      <PremiumCard className="p-6 sm:p-8">
        <InlineNotice tone="success">
          {t.forgot.sent}
        </InlineNotice>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label={t.common.emailLabel} required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!emailError}
            placeholder="you@example.com"
            dir="ltr"
            autoComplete="email"
            autoFocus
          />
          <FormError>{emailError}</FormError>
        </Field>

        {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t.forgot.sending : t.forgot.submit}
        </Button>
      </form>
    </PremiumCard>
  );
}
