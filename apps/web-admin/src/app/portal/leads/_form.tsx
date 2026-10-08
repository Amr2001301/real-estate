'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, Info, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { SearchSelect } from '@/components/form/search-select';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { tx } from '@/lib/format';
import type { PortalProject, PortalUnit } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { portalLeadsVisitsT } from '@/messages/portal/leads-visits';
import { createPortalLeadAction, type PortalLeadFormState } from './actions';

interface Props {
  projects: PortalProject[];
  locale?: Locale;
}

export default function PortalLeadForm({ projects, locale = 'ar' }: Props) {
  const m = portalLeadsVisitsT(locale).leads.form;
  const NAV_SECTIONS = [
    { id: 'section-client', num: '01', label: m.nav.client.label, sub: m.nav.client.sub },
    { id: 'section-interest', num: '02', label: m.nav.interest.label, sub: m.nav.interest.sub },
    { id: 'section-notes', num: '03', label: m.nav.notes.label, sub: m.nav.notes.sub },
  ];
  const [state, formAction] = useActionState<PortalLeadFormState, FormData>(
    createPortalLeadAction,
    {},
  );

  // Selected project drives which units are offered. Until a project is
  // picked every broker-visible unit is searchable so the field still works
  // on its own; once a project is chosen the search is scoped to it. Searched
  // on the server: this used to preload ?pageSize=200 units.
  const [projectId, setProjectId] = useState('');

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}
      {state.duplicate && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 px-5 py-4 text-sm shadow-soft">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {m.duplicateTitle}
            </p>
            <p className="text-xs">
              {m.duplicateBody}{' '}
              <Link
                href={`/portal/leads/${state.duplicate.id}` as never}
                className="font-semibold underline"
              >
                {m.viewClient}
              </Link>
            </p>
          </div>
        </div>
      )}

      <PremiumFormLayout
        locale={locale}
        navSections={NAV_SECTIONS}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-client"
          number="01"
          title={m.clientTitle}
          description={m.clientDescription}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={m.fullName} name="fullName" required>
            <Input id="fullName" name="fullName" required minLength={2} />
          </Field>
          <Field label={m.phone} name="phone" required hint={m.phoneHint}>
            <Input
              id="phone"
              name="phone"
              required
              dir="ltr"
              placeholder="+9665…"
            />
          </Field>
          <Field label={m.email} name="email" hint={m.optional}>
            <Input id="email" name="email" type="email" dir="ltr" />
          </Field>
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-interest"
          number="02"
          title={m.interestTitle}
          description={m.interestDescription}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={m.project} name="projectInterestId" hint={m.projectHint}>
            <Select
              id="projectInterestId"
              name="projectInterestId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">{m.projectLater}</option>
              {projects.map((p) => (
                <option key={p.project.id} value={p.project.id}>
                  {tx(p.project.name, locale)} — {p.project.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.unit} name="unitInterestId" hint={m.optional}>
            {/* Keyed by project: changing it clears the unit, so a stale unit
                from another project can't be submitted. */}
            <SearchSelect<PortalUnit>
              key={projectId}
              name="unitInterestId"
              endpoint={`/api-proxy/portal/units${
                projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
              }`}
              toOption={(u) => ({
                id: u.id,
                label: `${u.code} • ${tx(u.building.phase.project.name, locale)} (${u.type})`,
                raw: u,
              })}
              placeholder={m.unitPlaceholder}
            />
          </Field>
        </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-notes"
          number="03"
          title={m.notesTitle}
          description={m.notesDescription}
        >
          <Field label={m.note} name="note">
            <Textarea id="note" name="note" rows={4} />
          </Field>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/leads">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                {m.cancel}
              </Button>
            </Link>
            <SubmitButton locale={locale}>{m.submit}</SubmitButton>
          </>
        }
        helper={m.footerHelper}
      />
    </form>
  );
}
