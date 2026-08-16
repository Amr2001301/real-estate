'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { salesActorLabel } from '@/lib/sales-actor';
import { ClientPicker } from '@/components/crm/client-picker';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Project, LeadSource, User } from '@/lib/types';
import { tx } from '@/lib/format';
import { createLeadAction, type LeadFormState } from './actions';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';

interface SlimUnit {
  id: string;
  code: string;
  type: string;
  projectId: string;
}

interface Props {
  projects: Project[];
  sources: LeadSource[];
  sales: User[];
  units?: SlimUnit[];
  initialClient?: User | null;
  locale?: Locale;
}

export default function LeadForm({ projects, sources, sales, units = [], initialClient, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.leadsForm;
  const [state, formAction] = useActionState<LeadFormState, FormData>(
    createLeadAction,
    {},
  );

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const filteredUnits = units.filter((u) => u.projectId === selectedProjectId);

  const navSections = [
    { id: 'section-client',     num: '01', label: m.navClient.label,     sub: m.navClient.sub },
    { id: 'section-interest',   num: '02', label: m.navInterest.label,   sub: m.navInterest.sub },
    { id: 'section-assignment', num: '03', label: m.navAssignment.label, sub: m.navAssignment.sub },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-5 py-4 text-sm shadow-soft">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      <PremiumFormLayout
        navSections={navSections}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-client"
          number="01"
          title={m.panelClientTitle}
          description={m.panelClientDesc}
        >
          <ClientPicker initialClient={initialClient ?? null} />
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-interest"
          number="02"
          title={m.panelInterestTitle}
          description={m.panelInterestDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelSource} name="sourceId">
              <Select id="sourceId" name="sourceId" defaultValue="">
                <option value="">{m.optionUnset}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {tx(s.name)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={m.labelProject} name="projectInterestId">
              <Select
                id="projectInterestId"
                name="projectInterestId"
                defaultValue=""
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">{m.optionUnset}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {tx(p.name)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {selectedProjectId && (
            <Field
              label={m.labelUnit}
              name="unitInterestId"
              hint={m.hintUnit}
            >
              <Select id="unitInterestId" name="unitInterestId" defaultValue="">
                <option value="">{m.optionUnset}</option>
                {filteredUnits.length === 0 ? (
                  <option disabled value="">{m.noUnits}</option>
                ) : (
                  filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}{u.type ? ` · ${u.type}` : ''}
                    </option>
                  ))
                )}
              </Select>
            </Field>
          )}
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-assignment"
          number="03"
          title={m.panelAssignTitle}
          description={m.panelAssignDesc}
        >
          <div className="flex flex-col gap-5">
            <Field label={m.labelSales} name="assignedSalesId">
              <Select id="assignedSalesId" name="assignedSalesId" defaultValue="">
                <option value="">{m.optionUnsetSales}</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {salesActorLabel(s)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={m.labelNotes}
              name="notes"
              hint={m.hintNotes}
            >
              <Textarea id="notes" name="notes" rows={3} />
            </Field>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/leads' as never}>
              <Button
                type="button"
                variant="ghost"
                leftIcon={<X className="h-4 w-4" />}
              >
                {m.cancelBtn}
              </Button>
            </Link>
            <SubmitButton>{m.submitBtn}</SubmitButton>
          </>
        }
        helper={m.footerHelper}
      />
    </form>
  );
}
