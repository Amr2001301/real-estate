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

export function ResetPasswordCard({ token }: { token: string }) {
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
          رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا من صفحة{' '}
          <a href={routes.forgotPassword} className="underline underline-offset-4">نسيت كلمة المرور</a>.
        </InlineNotice>
      </PremiumCard>
    );
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (newPassword.length < 8) e.newPassword = 'كلمة المرور يجب ألا تقل عن ٨ أحرف.';
    if (confirm !== newPassword) e.confirm = 'كلمتا المرور غير متطابقتين.';
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
      setTopError('تعذر الاتصال بالخادم حاليًا. حاول مرة أخرى بعد لحظات.');
    } else if (res.status === 400) {
      setTopError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.');
    } else {
      setTopError('حدث خطأ أثناء تنفيذ الطلب. يرجى المحاولة مرة أخرى.');
    }
  }

  return (
    <PremiumCard className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="كلمة المرور الجديدة" required>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            invalid={!!errors.newPassword}
            placeholder="٨ أحرف على الأقل"
            autoComplete="new-password"
            autoFocus
          />
          <FormError>{errors.newPassword}</FormError>
        </Field>

        <Field label="تأكيد كلمة المرور" required>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!errors.confirm}
            placeholder="أعد إدخال كلمة المرور"
            autoComplete="new-password"
          />
          <FormError>{errors.confirm}</FormError>
        </Field>

        {topError && <InlineNotice tone="error">{topError}</InlineNotice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'جارٍ الحفظ...' : 'تعيين كلمة المرور الجديدة'}
        </Button>
      </form>
    </PremiumCard>
  );
}
