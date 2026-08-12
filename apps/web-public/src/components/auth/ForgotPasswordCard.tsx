'use client';

import { useState } from 'react';
import { forgotPasswordAction } from '@/lib/auth-actions';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordCard() {
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
      setEmailError('صيغة البريد الإلكتروني غير صحيحة.');
      return;
    }

    setPending(true);
    const res = await forgotPasswordAction({ email: email.trim() });
    setPending(false);

    if (res.status === 0) {
      setTopError('تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.');
      return;
    }
    // Always show success to avoid user enumeration.
    setSent(true);
  }

  if (sent) {
    return (
      <PremiumCard className="p-6 sm:p-8">
        <InlineNotice tone="success">
          إذا كان البريد الإلكتروني مسجّلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة التعيين خلال دقائق. تحقق من صندوق الوارد أو مجلد البريد غير المرغوب فيه.
        </InlineNotice>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="البريد الإلكتروني" required>
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
          {pending ? 'جارٍ الإرسال...' : 'إرسال رابط إعادة التعيين'}
        </Button>
      </form>
    </PremiumCard>
  );
}
