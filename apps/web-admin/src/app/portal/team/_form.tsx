'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { BrokerUser } from '@/lib/types';
import type { TeamFormState } from './actions';
import type { Locale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';

type Action = (prev: TeamFormState, formData: FormData) => Promise<TeamFormState>;

interface Props {
  action: Action;
  initial?: BrokerUser;
  submitLabel: string;
  /** When true, hides password & invitation-only fields. */
  isEdit?: boolean;
  locale?: Locale;
}

export function TeamMemberForm({ action, initial, submitLabel, isEdit, locale = 'ar' }: Props) {
  const t = portalMoneyTeamT(locale).team.form;
  const navSections = [
    { id: 'section-personal',    num: '01', label: t.nav.personal.label,    sub: t.nav.personal.sub },
    { id: 'section-permissions', num: '02', label: t.nav.permissions.label, sub: t.nav.permissions.sub },
  ];
  const [state, formAction] = useActionState<TeamFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state?.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        locale={locale}
        navSections={navSections}
        sidebarTitle={t.sidebarTitle}
        sidebarBadge={t.sidebarBadge}
        sidebarInfo={t.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-personal"
          number="01"
          title={t.personalTitle}
          description={t.personalDescription}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t.fullName} name="fullName" required>
            <Input id="fullName" name="fullName" defaultValue={initial?.user.fullName ?? ''} required />
          </Field>
          <Field label={t.jobTitle} name="jobTitle">
            <Input id="jobTitle" name="jobTitle" defaultValue={initial?.jobTitle ?? ''} />
          </Field>
          <Field label={t.email} name="email">
            <Input id="email" name="email" type="email" dir="ltr" defaultValue={initial?.user.email ?? ''} />
          </Field>
          <Field label={t.phone} name="phone">
            <Input id="phone" name="phone" dir="ltr" defaultValue={initial?.user.phone ?? ''} />
          </Field>
          <Field label={t.preferredLanguage} name="locale">
            <Select id="locale" name="locale" defaultValue={initial?.user.locale ?? 'ar'}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>
          {!isEdit && (
            <Field label={t.password} name="password" hint={t.passwordHint}>
              <Input id="password" name="password" type="password" dir="ltr" minLength={8} placeholder={t.passwordPlaceholder} />
            </Field>
          )}
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-permissions"
          number="02"
          title={t.permissionsTitle}
          description={t.permissionsDescription}
        >
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="isPrimaryContact"
              defaultChecked={initial?.isPrimaryContact ?? false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">{t.primaryContact}</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                {t.primaryContactHelp}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="canManageBrokerUsers"
              defaultChecked={initial?.canManageBrokerUsers ?? false}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">{t.manageTeam}</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                {t.manageTeamHelp}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="canViewCommissions"
              defaultChecked={initial ? initial.canViewCommissions : true}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
            />
            <span>
              <span className="block font-medium text-slate-800">{t.viewCommissions}</span>
              <span className="block text-2xs text-slate-500 mt-0.5">
                {t.viewCommissionsHelp}
              </span>
            </span>
          </label>
        </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/team">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                {t.cancel}
              </Button>
            </Link>
            <SubmitButton pendingLabel={t.saving} locale={locale}>{submitLabel}</SubmitButton>
          </>
        }
      />
    </form>
  );
}
