'use client';

import { useActionState, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { createBrokerUserAction, type BrokerUserFormState } from '../../actions';

interface Props {
  brokerId: string;
}

export default function CreateBrokerUserForm({ brokerId }: Props) {
  const action = createBrokerUserAction.bind(null, brokerId);
  const [state, formAction] = useActionState<BrokerUserFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful submit.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3"
    >
      {state.error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-2 rounded-xl bg-success-50 border border-success-100 text-success-700 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">تمت إضافة الموظف</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="الاسم الكامل" name="fullName" required>
          <Input id="fullName" name="fullName" required />
        </Field>
        <Field label="الوظيفة" name="jobTitle">
          <Input id="jobTitle" name="jobTitle" />
        </Field>
        <Field label="البريد الإلكتروني" name="email" hint="مطلوب البريد أو الجوال على الأقل">
          <Input id="email" name="email" type="email" dir="ltr" />
        </Field>
        <Field label="رقم الجوال" name="phone">
          <Input id="phone" name="phone" dir="ltr" />
        </Field>
        <Field
          label="كلمة المرور المؤقتة"
          name="password"
          hint="اختياري — إذا تُركت فارغة سيسجل الموظف عبر OTP"
        >
          <Input id="password" name="password" type="password" minLength={8} dir="ltr" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Checkbox name="isPrimaryContact" />
          <span>جهة الاتصال الرئيسية</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Checkbox name="canManageBrokerUsers" />
          <span>صلاحية إدارة الموظفين</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <Checkbox name="canViewCommissions" defaultChecked />
          <span>عرض العمولات</span>
        </label>
      </div>

      <div className="flex justify-end">
        <SubmitButton>إضافة الموظف</SubmitButton>
      </div>
    </form>
  );
}
