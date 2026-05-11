'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X, Lock } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import type { User } from '@/lib/types';
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from './actions';

interface Props {
  user?: User;
  defaultRole?: 'CLIENT' | 'CUSTOMER';
}

export default function ClientForm({ user, defaultRole = 'CLIENT' }: Props) {
  const isEdit = Boolean(user);
  const action = user ? updateClientAction.bind(null, user.id) : createClientAction;
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const role = (user?.role ?? defaultRole) as 'CLIENT' | 'CUSTOMER';
  const cancelHref = isEdit
    ? `/dashboard/clients/${user!.id}`
    : `/dashboard/clients?role=${role}`;

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تم حفظ التغييرات بنجاح</p>
        </div>
      )}

      <FormSection
        title="المعلومات الشخصية"
        description="الاسم الكامل ونوع العميل في النظام."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" name="fullName" required>
            <Input
              id="fullName"
              name="fullName"
              required
              minLength={2}
              placeholder="مثال: أحمد منصور"
              defaultValue={user?.fullName}
            />
          </Field>

          <Field
            label="نوع العميل"
            name="role"
            hint={isEdit ? 'لا يمكن تعديل النوع بعد الإنشاء' : undefined}
          >
            {isEdit ? (
              <>
                <Input
                  value={role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                  readOnly
                  rightAddon={<Lock />}
                  className="bg-surface-muted"
                />
                <input type="hidden" name="role" value={role} />
              </>
            ) : (
              <Select id="role" name="role" defaultValue={role}>
                <option value="CLIENT">متصفّح (Client)</option>
                <option value="CUSTOMER">مالك (Customer)</option>
              </Select>
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="معلومات التواصل"
        description="يجب توفير البريد الإلكتروني أو رقم الهاتف على الأقل."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="البريد الإلكتروني"
            name="email"
            hint={isEdit ? 'لا يمكن تعديل البريد الإلكتروني حالياً' : 'اختياري'}
          >
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              placeholder="user@example.com"
              defaultValue={user?.email ?? ''}
              readOnly={isEdit}
              rightAddon={isEdit ? <Lock /> : undefined}
              className={isEdit ? 'bg-surface-muted' : undefined}
            />
          </Field>

          <Field label="رقم الهاتف" name="phone" hint="اختياري">
            <Input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              placeholder="+966 5X XXX XXXX"
              defaultValue={user?.phone ?? ''}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="التفضيلات"
        description="اللغة الافتراضية للتواصل مع العميل."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="اللغة المفضلة" name="locale">
            <Select id="locale" name="locale" defaultValue={user?.locale ?? 'ar'}>
              <option value="ar">العربية</option>
              <option value="en">الإنجليزية</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={cancelHref as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>{isEdit ? 'حفظ التغييرات' : 'إنشاء العميل'}</SubmitButton>
          </>
        }
        helper={
          isEdit
            ? 'سيتم تحديث بيانات العميل فور الحفظ.'
            : 'سيتم تسجيل العميل في النظام بدون كلمة مرور (وصول العميل عبر OTP).'
        }
      />
    </form>
  );
}
