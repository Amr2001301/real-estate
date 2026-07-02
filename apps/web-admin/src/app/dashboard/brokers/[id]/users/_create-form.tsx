'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { createBrokerUserAction, type BrokerUserFormState } from '../../actions';

function FormField({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

interface Props {
  brokerId: string;
}

export default function CreateBrokerUserForm({ brokerId }: Props) {
  const action = createBrokerUserAction.bind(null, brokerId);
  const [state, formAction] = useActionState<BrokerUserFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3.5 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-2 rounded-xl bg-success-50 border border-success-100 text-success-700 p-3.5 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium">تمت إضافة الموظف بنجاح</p>
        </div>
      )}

      {/* بيانات الموظف — 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="الاسم الكامل" required>
          <Input id="fullName" name="fullName" required />
        </FormField>
        <FormField label="الوظيفة">
          <Input id="jobTitle" name="jobTitle" />
        </FormField>
        <FormField label="البريد الإلكتروني" hint="مطلوب البريد أو الجوال على الأقل">
          <Input id="email" name="email" type="email" dir="ltr" />
        </FormField>
        <FormField label="رقم الجوال">
          <Input id="phone" name="phone" dir="ltr" />
        </FormField>

        {/* كلمة المرور — half width + eye toggle */}
        <FormField
          label="كلمة المرور المؤقتة"
          hint="اختياري — إذا تُركت فارغة سيسجل الموظف عبر OTP"
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPwd ? 'text' : 'password'}
              minLength={8}
              dir="ltr"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
              aria-label={showPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>
      </div>

      {/* الصلاحيات + زر الإرسال — نفس الصف */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-hairline">
        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            الصلاحيات والإعدادات
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <Checkbox name="isPrimaryContact" />
              <span>جهة الاتصال الرئيسية</span>
            </label>
            <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <Checkbox name="canManageBrokerUsers" />
              <span>صلاحية إدارة الموظفين</span>
            </label>
            <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <Checkbox name="canViewCommissions" defaultChecked />
              <span>عرض العمولات</span>
            </label>
          </div>
        </div>
        <SubmitButton>إضافة الموظف</SubmitButton>
      </div>
    </form>
  );
}
