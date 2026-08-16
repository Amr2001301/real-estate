'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X, Lock } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { User } from '@/lib/types';
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from './actions';

interface Props {
  user?: User;
  defaultRole?: 'CLIENT' | 'CUSTOMER';
  locale?: Locale;
}

export default function ClientForm({ user, defaultRole = 'CLIENT', locale = 'ar' }: Props) {
  const m = uiT(locale).pages.clientsForm;
  const isEdit = Boolean(user);
  const action = user ? updateClientAction.bind(null, user.id) : createClientAction;
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const role = (user?.role ?? defaultRole) as 'CLIENT' | 'CUSTOMER';
  const cancelHref = isEdit
    ? `/dashboard/clients/${user!.id}`
    : `/dashboard/clients?role=${role}`;

  const navSections = [
    { id: 'section-personal',    num: '01', label: m.navPersonal.label,  sub: m.navPersonal.sub },
    { id: 'section-contact',     num: '02', label: m.navContact.label,   sub: m.navContact.sub },
    { id: 'section-preferences', num: '03', label: m.navPrefs.label,     sub: m.navPrefs.sub },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-3 rounded-2xl bg-success-50 border border-success-100 text-success-700 px-5 py-4 text-sm shadow-soft">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{m.saveOk}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={navSections}
        sidebarBadge={isEdit ? m.badgeEdit : m.badgeNew}
        sidebarInfo={isEdit ? m.sidebarInfoEdit : m.sidebarInfoNew}
      >
        <PremiumFormPanel
          id="section-personal"
          number="01"
          title={m.panelPersonalTitle}
          description={m.panelPersonalDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelFullName} name="fullName" required>
              <Input
                id="fullName"
                name="fullName"
                required
                minLength={2}
                placeholder={m.placeholderFullName}
                defaultValue={user?.fullName}
              />
            </Field>

            <Field
              label={m.labelRole}
              name="role"
              hint={isEdit ? m.hintRoleEdit : undefined}
            >
              {isEdit ? (
                <>
                  <Input
                    value={role === 'CUSTOMER' ? m.roleCustomerDisplay : m.roleClientDisplay}
                    readOnly
                    rightAddon={<Lock />}
                    className="bg-surface-muted"
                  />
                  <input type="hidden" name="role" value={role} />
                </>
              ) : (
                <Select id="role" name="role" defaultValue={role}>
                  <option value="CLIENT">{m.optionClient}</option>
                  <option value="CUSTOMER">{m.optionCustomer}</option>
                </Select>
              )}
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-contact"
          number="02"
          title={m.panelContactTitle}
          description={m.panelContactDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={m.labelEmail}
              name="email"
              hint={isEdit ? m.hintEmailEdit : m.hintOptional}
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

            <Field label={m.labelPhone} name="phone" hint={m.hintOptional}>
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
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-preferences"
          number="03"
          title={m.panelPrefsTitle}
          description={m.panelPrefsDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelLocale} name="locale">
              <Select id="locale" name="locale" defaultValue={user?.locale ?? 'ar'}>
                <option value="ar">{m.optionAr}</option>
                <option value="en">{m.optionEn}</option>
              </Select>
            </Field>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={cancelHref as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                {m.cancelBtn}
              </Button>
            </Link>
            <SubmitButton>{isEdit ? m.submitEdit : m.submitNew}</SubmitButton>
          </>
        }
        helper={isEdit ? m.footerHelperEdit : m.footerHelperNew}
      />
    </form>
  );
}
