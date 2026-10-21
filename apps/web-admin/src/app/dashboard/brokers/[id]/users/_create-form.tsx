'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createBrokerUserAction, type BrokerUserFormState } from '../../actions';
import { Switch } from './_switch';

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
    <div className="grid gap-1.5">
      <label className="text-[12.5px] font-semibold text-slate-700">
        {label}
        {required && <span className="ms-1 text-danger-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-slate-500">{hint}</p>}
    </div>
  );
}

interface Props {
  brokerId: string;
  locale?: Locale;
}

export default function CreateBrokerUserForm({ brokerId, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.brokerUsersPage;
  const en = locale === 'en';
  const action = createBrokerUserAction.bind(null, brokerId);
  const [state, formAction] = useActionState<BrokerUserFormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // The browser must not offer the signed-in admin's own email and saved
  // password here: this form creates someone else's account.
  return (
    <form ref={formRef} action={formAction} autoComplete="off" className="flex flex-col gap-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-500/10 p-3.5 text-sm text-danger-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/12 p-3.5 text-sm text-emerald-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{m.createFormSuccess}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField label={m.createFormFullNameLabel} required>
          <Input id="fullName" name="fullName" required autoComplete="off" />
        </FormField>
        <FormField label={m.createFormJobLabel}>
          <Input id="jobTitle" name="jobTitle" autoComplete="off" />
        </FormField>
        <FormField label={m.createFormEmailLabel} hint={m.createFormEmailHint}>
          <Input id="email" name="email" type="email" dir="ltr" autoComplete="off" defaultValue="" leftAddon={<Mail />} />
        </FormField>
        <FormField label={m.createFormPhoneLabel}>
          <Input id="phone" name="phone" dir="ltr" autoComplete="off" leftAddon={<Phone />} />
        </FormField>
        <FormField
          label={m.createFormPasswordLabel}
          hint={en ? 'Optional — leave empty and the employee signs in with a verification code.' : 'اختياري — إن تُركت فارغة يدخل الموظف برمز تحقق يصله.'}
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPwd ? 'text' : 'password'}
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
              defaultValue=""
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 transition-colors hover:text-slate-600"
              tabIndex={-1}
              aria-label={showPwd ? m.hidePasswordLabel : m.showPasswordLabel}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>
      </div>

      <div>
        <p className="mb-3 text-[12.5px] font-semibold text-slate-700">{m.createFormPermissionsLabel}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Switch
            name="isPrimaryContact"
            label={m.createFormIsPrimary}
            desc={en ? 'The company’s main person for the team' : 'الشخص المسؤول عن الشركة أمام فريقنا'}
          />
          <Switch
            name="canManageBrokerUsers"
            label={m.createFormCanManage}
            desc={en ? 'Can add and edit colleagues in the portal' : 'يضيف ويعدّل زملاءه من بوابة الوسيط'}
          />
          <Switch
            name="canViewCommissions"
            label={m.createFormCanView}
            desc={en ? 'Sees the company’s commissions and payouts' : 'يرى عمولات الشركة ومدفوعاتها'}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-hairline pt-5">
        <SubmitButton>{m.createFormSubmitBtn}</SubmitButton>
      </div>
    </form>
  );
}
