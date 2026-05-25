'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { updateProfileAction } from '@/lib/account-actions';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Editable profile fields (fullName, phone). Mirrors the auth forms'
 * validation + InlineNotice UX. Submits via the updateProfileAction server
 * action — no tokens touch client JS.
 */
export function ProfileForm({
  initialFullName,
  initialPhone,
}: {
  initialFullName: string;
  initialPhone: string;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = 'يرجى إدخال الاسم الكامل.';
    if (!PHONE_RE.test(phone.trim().replace(/[\s-]/g, '')))
      e.phone = 'يرجى إدخال رقم جوال صحيح بصيغة دولية، مثال: +9665XXXXXXXX';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setTopError('');

    const res = await updateProfileAction({ fullName: fullName.trim(), phone: phone.trim() });

    if (res.ok) {
      setStatus('success');
    } else {
      setStatus('error');
      if (res.field) setErrors((prev) => ({ ...prev, [res.field as string]: res.error }));
      else setTopError(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="الاسم الكامل" required>
          <Input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (status !== 'idle') setStatus('idle');
            }}
            invalid={!!errors.fullName}
            placeholder="مثال: محمد الأحمد"
            autoComplete="name"
          />
          <FormError>{errors.fullName}</FormError>
        </Field>
        <Field label="رقم الجوال" required>
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (status !== 'idle') setStatus('idle');
            }}
            invalid={!!errors.phone}
            placeholder="+9665XXXXXXXX"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
          />
          <FormError>{errors.phone}</FormError>
        </Field>
      </div>

      {status === 'success' && <InlineNotice tone="success">تم تحديث بياناتك بنجاح</InlineNotice>}
      {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}

      <Button type="submit" size="md" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          'جارٍ الحفظ...'
        ) : (
          <>
            <Save className="h-5 w-5" aria-hidden />
            حفظ التغييرات
          </>
        )}
      </Button>
    </form>
  );
}
