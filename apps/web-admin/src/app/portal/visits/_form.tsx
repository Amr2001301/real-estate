'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { AlertCircle, X, User, Phone, Mail, Info } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { SearchSelect, type SearchOption } from '@/components/form/search-select';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import { tx } from '@/lib/format';
import { findPortalUnit, getUnitProjectId } from '@/lib/portal-units';
import type { PortalLead, PortalProject, PortalUnit } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { portalLeadsVisitsT } from '@/messages/portal/leads-visits';
import {
  createPortalVisitRequestAction,
  type PortalVisitFormState,
} from './actions';

interface Props {
  projects: PortalProject[];
  locale?: Locale;
}

// Leads and units are searched on the server (SearchSelect): this form used
// to preload ?pageSize=200 of each.
export default function PortalVisitForm({ projects, locale = 'ar' }: Props) {
  const m = portalLeadsVisitsT(locale).visits.form;
  const NAV_SECTIONS = [
    { id: 'section-lead', num: '01', label: m.nav.lead.label, sub: m.nav.lead.sub },
    { id: 'section-visit', num: '02', label: m.nav.visit.label, sub: m.nav.visit.sub },
    { id: 'section-customer', num: '03', label: m.nav.customer.label, sub: m.nav.customer.sub },
    { id: 'section-notes', num: '04', label: m.nav.notes.label, sub: m.nav.notes.sub },
  ];
  const [state, formAction] = useActionState<PortalVisitFormState, FormData>(
    createPortalVisitRequestAction,
    {},
  );
  const [selectedLead, setSelectedLead] = useState<PortalLead | null>(null);
  const [projectId, setProjectId] = useState('');
  // The lead's own unit, pre-selected when this broker can still see it.
  const [autoUnit, setAutoUnit] = useState<PortalUnit | null>(null);
  const leadRequest = useRef(0);

  function toUnitOption(u: PortalUnit): SearchOption<PortalUnit> {
    return { id: u.id, label: `${u.code} • ${tx(u.building.phase.project.name, locale)}`, raw: u };
  }

  function onLeadChange(lead: PortalLead | null) {
    const request = ++leadRequest.current;
    setSelectedLead(lead);
    // Prefill project/unit from the lead's interest. Customer name/phone/email
    // are read off `selectedLead` directly at render time.
    setProjectId(lead?.projectInterestId ?? '');
    setAutoUnit(null);
    if (!lead) return;
    void findPortalUnit(lead).then((unit) => {
      if (request === leadRequest.current) setAutoUnit(unit);
    });
  }

  function onProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    // The unit picker is keyed by project, so the chosen unit is dropped; keep
    // the lead's unit only if it belongs to the new project.
    if (autoUnit && getUnitProjectId(autoUnit) !== nextProjectId) setAutoUnit(null);
  }

  const hasLead = selectedLead !== null;

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        locale={locale}
        navSections={NAV_SECTIONS}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-lead"
          number="01"
          title={m.leadTitle}
          description={m.leadDescription}
        >
        <Field label={m.existingLead} name="leadId">
          {/* Empty = a new customer, entered below. */}
          <SearchSelect<PortalLead>
            name="leadId"
            endpoint="/api-proxy/portal/leads"
            toOption={(l) => ({ id: l.id, label: `${l.fullName} • ${l.phone}`, raw: l })}
            onChange={onLeadChange}
            placeholder={m.leadPlaceholder}
          />
        </Field>

        {hasLead && (
          <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-xs font-semibold text-brand-700 mb-2">
              {m.leadCustomerData}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-700">
                <User className="h-4 w-4 text-slate-400" />
                {selectedLead!.fullName}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Phone className="h-4 w-4 text-slate-400" />
                {selectedLead!.phone}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-700" dir="ltr">
                <Mail className="h-4 w-4 text-slate-400" />
                {selectedLead!.email ?? '—'}
              </span>
            </div>
            {/* Carry the lead's customer data through submission. The backend
                falls back to the lead's own fields, but sending them keeps the
                payload explicit and future-proof. */}
            <input type="hidden" name="customerName" value={selectedLead!.fullName} />
            <input type="hidden" name="customerPhone" value={selectedLead!.phone} />
            {selectedLead!.email && (
              <input type="hidden" name="customerEmail" value={selectedLead!.email} />
            )}
          </div>
        )}
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-visit"
          number="02"
          title={m.visitTitle}
          description={m.visitDescription}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={m.project} name="projectId" required>
            <Select
              id="projectId"
              name="projectId"
              required
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              <option value="" disabled>
                {m.chooseProject}
              </option>
              {projects.map((p) => (
                <option key={p.project.id} value={p.project.id}>
                  {tx(p.project.name, locale)} — {p.project.city}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.unit} name="unitId" hint={m.optional}>
            {/* Scoped to the project; until one is chosen every
                broker-visible unit is searchable. */}
            <SearchSelect<PortalUnit>
              key={`${projectId}:${autoUnit?.id ?? ''}`}
              name="unitId"
              endpoint={`/api-proxy/portal/units${
                projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
              }`}
              toOption={toUnitOption}
              initial={autoUnit ? toUnitOption(autoUnit) : null}
              placeholder={m.unitPlaceholder}
            />
          </Field>
          <Field label={m.preferredDate} name="preferredDate" required hint={m.preferredDateHint}>
            <Input id="preferredDate" name="preferredDate" type="date" required dir="ltr" />
          </Field>
        </div>
        </PremiumFormPanel>

        {!hasLead && (
        <PremiumFormPanel
          id="section-customer"
          number="03"
          title={m.customerTitle}
          description={m.customerDescription}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.fullName} name="customerName" required>
              <Input id="customerName" name="customerName" required minLength={2} />
            </Field>
            <Field label={m.phone} name="customerPhone" required>
              <Input
                id="customerPhone"
                name="customerPhone"
                required
                dir="ltr"
                placeholder="+9665…"
              />
            </Field>
            <Field label={m.email} name="customerEmail" hint={m.optional}>
              <Input id="customerEmail" name="customerEmail" type="email" dir="ltr" />
            </Field>
          </div>
        </PremiumFormPanel>
        )}

        {hasLead && (
          <div className="flex items-start gap-2 rounded-xl bg-info-50/60 border border-info-100 text-info-700 p-3 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {m.leadDataNotice}
            </p>
          </div>
        )}

        <PremiumFormPanel
          id="section-notes"
          number="04"
          title={m.notesTitle}
          description={m.notesDescription}
        >
          <Field label={m.note} name="notes">
            <Textarea id="notes" name="notes" rows={3} />
          </Field>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/visits">
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
