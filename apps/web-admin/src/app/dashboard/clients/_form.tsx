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
import { FIXED_DETAILS, dayOf, fieldLabel, type CustomerFieldDef } from '@/lib/customer-fields';
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from './actions';

interface Props {
  user?: User;
  defaultRole?: 'CLIENT' | 'CUSTOMER';
  locale?: Locale;
  /** The company's own customer fields (the active ones are filled here). */
  fields?: CustomerFieldDef[];
}

export default function ClientForm({ user, defaultRole = 'CLIENT', locale = 'ar', fields = [] }: Props) {
  const m = uiT(locale).pages.clientsForm;
  const isEdit = Boolean(user);
  const action = user ? updateClientAction.bind(null, user.id) : createClientAction;
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const role = (user?.role ?? defaultRole) as 'CLIENT' | 'CUSTOMER';
  const cancelHref = isEdit
    ? `/dashboard/clients/${user!.id}`
    : `/dashboard/clients?role=${role}`;

  const ownFields = fields.filter((f) => f.active);
  const stored = user?.customFields ?? {};

  const navSections = [
    { id: 'section-personal',    num: '01', label: m.navPersonal.label,  sub: m.navPersonal.sub },
    { id: 'section-contact',     num: '02', label: m.navContact.label,   sub: m.navContact.sub },
    { id: 'section-identity',    num: '03', label: m.navIdentity.label,  sub: m.navIdentity.sub },
    { id: 'section-details',     num: '04', label: m.navDetails.label,   sub: m.navDetails.sub },
    ...(ownFields.length ? [{ id: 'section-custom', num: '05', label: m.navCustom.label, sub: m.navCustom.sub }] : []),
    { id: 'section-preferences', num: ownFields.length ? '06' : '05', label: m.navPrefs.label, sub: m.navPrefs.sub },
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
                placeholder="+20 10 XXXX XXXX"
                defaultValue={user?.phone ?? ''}
              />
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-identity"
          number="03"
          title={m.panelIdentityTitle}
          description={m.panelIdentityDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelNationalId} name="nationalId" hint={m.hintOptional}>
              <Input
                id="nationalId"
                name="nationalId"
                dir="ltr"
                inputMode="numeric"
                maxLength={20}
                pattern="[A-Za-z0-9]{5,20}"
                placeholder={m.placeholderNationalId}
                defaultValue={user?.nationalId ?? ''}
              />
            </Field>
            <Field label={m.labelAddress} name="address" hint={m.hintOptional}>
              <Input
                id="address"
                name="address"
                maxLength={300}
                placeholder={m.placeholderAddress}
                defaultValue={user?.address ?? ''}
              />
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-details"
          number="04"
          title={m.panelDetailsTitle}
          description={m.panelDetailsDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIXED_DETAILS.map((d) => {
              const isDate = 'date' in d && d.date;
              const value = (user?.[d.key] as string | null | undefined) ?? '';
              return (
                <Field key={d.key} label={locale === 'en' ? d.en : d.ar} name={d.key} hint={m.hintOptional}>
                  <Input
                    id={d.key}
                    name={d.key}
                    type={isDate ? 'date' : d.key === 'homePhone' ? 'tel' : 'text'}
                    dir={isDate || d.key === 'homePhone' ? 'ltr' : undefined}
                    maxLength={d.key === 'employer' ? 200 : d.key === 'homePhone' ? 30 : 120}
                    defaultValue={isDate ? dayOf(value) : value}
                  />
                </Field>
              );
            })}
          </div>
        </PremiumFormPanel>

        {ownFields.length > 0 && (
          <PremiumFormPanel
            id="section-custom"
            number="05"
            title={m.panelCustomTitle}
            description={m.panelCustomDesc}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ownFields.map((f) => {
                const name = `custom.${f.key}`;
                const value = stored[f.key] ?? '';
                return (
                  <Field key={f.id} label={fieldLabel(f, locale)} name={name} hint={m.hintOptional}>
                    {f.type === 'SELECT' ? (
                      <Select id={name} name={name} defaultValue={String(value)}>
                        <option value="">—</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        {value !== '' && !f.options.includes(String(value)) && (
                          <option value={String(value)}>{String(value)}</option>
                        )}
                      </Select>
                    ) : (
                      <Input
                        id={name}
                        name={name}
                        type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'}
                        step={f.type === 'NUMBER' ? 'any' : undefined}
                        dir={f.type === 'TEXT' ? undefined : 'ltr'}
                        maxLength={f.type === 'TEXT' ? 300 : undefined}
                        defaultValue={String(value)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </PremiumFormPanel>
        )}

        <PremiumFormPanel
          id="section-preferences"
          number={ownFields.length ? '06' : '05'}
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
