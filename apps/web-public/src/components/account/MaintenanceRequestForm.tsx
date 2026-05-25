'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { routes } from '@/lib/routes';
import { createMaintenanceRequestAction } from '@/lib/account-actions';
import { Button } from '@/components/ui/Button';
import { Select, Textarea, Field } from '@/components/ui/Input';
import { FormError } from '@/components/states/FormError';
import { InlineNotice } from '@/components/states/InlineNotice';

export interface SelectOption {
  id: string;
  label: string;
}

type Status = 'idle' | 'submitting' | 'error';

/**
 * Create-maintenance form. Units come from the customer's contracts and
 * categories from the API; both validated client-side and re-validated in the
 * server action (which is the real authority alongside the backend).
 */
export function MaintenanceRequestForm({
  units,
  categories,
  initialUnitId = '',
}: {
  units: SelectOption[];
  categories: SelectOption[];
  initialUnitId?: string;
}) {
  const router = useRouter();
  const [unitId, setUnitId] = useState(initialUnitId);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [topError, setTopError] = useState('');

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!unitId) e.unitId = 'يرجى اختيار الوحدة.';
    if (!categoryId) e.categoryId = 'يرجى اختيار فئة الصيانة.';
    if (description.trim().length < 5) e.description = 'يرجى كتابة وصف للمشكلة لا يقل عن ٥ أحرف.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setTopError('');

    const res = await createMaintenanceRequestAction({ unitId, categoryId, description: description.trim() });

    if (res.ok) {
      router.push(routes.accountMaintenance);
      router.refresh();
    } else {
      setStatus('error');
      if (res.field) setErrors((prev) => ({ ...prev, [res.field as string]: res.error }));
      else setTopError(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label="الوحدة" required>
        <Select
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.unitId}
        >
          <option value="">اختر الوحدة</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
        <FormError>{errors.unitId}</FormError>
      </Field>

      <Field label="فئة الصيانة" required>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.categoryId}
        >
          <option value="">اختر الفئة</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <FormError>{errors.categoryId}</FormError>
      </Field>

      <Field label="وصف المشكلة" required>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          invalid={!!errors.description}
          placeholder="اشرح المشكلة بالتفصيل ليتمكن فريقنا من مساعدتك..."
        />
        <FormError>{errors.description}</FormError>
      </Field>

      {status === 'error' && topError && <InlineNotice tone="error">{topError}</InlineNotice>}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          'جارٍ الإرسال...'
        ) : (
          <>
            <Send className="h-5 w-5" aria-hidden />
            إرسال الطلب
          </>
        )}
      </Button>
    </form>
  );
}
