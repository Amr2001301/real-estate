'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { Broker } from '@/lib/types';
import {
  createBrokerAction,
  updateBrokerAction,
  type BrokerFormState,
} from './actions';

interface Props {
  broker?: Broker;
  locale?: Locale;
}

function dateInputValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function pctValue(value: string | number | null | undefined): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : value;
}

export default function BrokerForm({ broker, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.brokersForm;
  const action = broker
    ? updateBrokerAction.bind(null, broker.id)
    : createBrokerAction;
  const [state, formAction] = useActionState<BrokerFormState, FormData>(action, {});

  const isEdit = Boolean(broker);
  const cancelHref = isEdit ? `/dashboard/brokers/${broker!.id}` : '/dashboard/brokers';

  const navSections = [
    { id: 'section-basic',      num: '01', label: m.navBasic.label,      sub: m.navBasic.sub },
    { id: 'section-contact',    num: '02', label: m.navContact.label,    sub: m.navContact.sub },
    { id: 'section-legal',      num: '03', label: m.navLegal.label,      sub: m.navLegal.sub },
    { id: 'section-commission', num: '04', label: m.navCommission.label, sub: m.navCommission.sub },
    { id: 'section-notes',      num: '05', label: m.navNotes.label,      sub: m.navNotes.sub },
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
          id="section-basic"
          number="01"
          title={m.panelBasicTitle}
          description={m.panelBasicDesc}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.labelCompanyName} name="companyName" required>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  defaultValue={broker?.companyName}
                />
              </Field>
              <Field label={m.labelCommercialName} name="commercialName" hint={m.hintOptional}>
                <Input
                  id="commercialName"
                  name="commercialName"
                  defaultValue={broker?.commercialName ?? ''}
                />
              </Field>
            </div>
            <Field
              label={m.labelCode}
              name="code"
              hint={isEdit ? m.hintCodeEdit : m.hintCodeNew}
            >
              <Input
                id="code"
                name="code"
                placeholder="e.g. RIYADH-REALTY"
                dir="ltr"
                defaultValue={broker?.code ?? ''}
              />
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
            <Field label={m.labelEmail} name="email">
              <Input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                defaultValue={broker?.email ?? ''}
              />
            </Field>
            <Field label={m.labelPhone} name="phone">
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                defaultValue={broker?.phone ?? ''}
              />
            </Field>
            <Field label={m.labelCity} name="city">
              <Input id="city" name="city" defaultValue={broker?.city ?? ''} />
            </Field>
            <Field label={m.labelAddress} name="address">
              <Input id="address" name="address" defaultValue={broker?.address ?? ''} />
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-legal"
          number="03"
          title={m.panelLegalTitle}
          description={m.panelLegalDesc}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelTaxId} name="taxId" hint={m.hintTaxId}>
              <Input
                id="taxId"
                name="taxId"
                dir="ltr"
                defaultValue={broker?.taxId ?? ''}
              />
            </Field>
            <Field label={m.labelCommReg} name="commercialRegistration">
              <Input
                id="commercialRegistration"
                name="commercialRegistration"
                dir="ltr"
                defaultValue={broker?.commercialRegistration ?? ''}
              />
            </Field>
            <Field label={m.labelBankName} name="bankName">
              <Input
                id="bankName"
                name="bankName"
                defaultValue={broker?.bankName ?? ''}
              />
            </Field>
            <Field label={m.labelBankAccountName} name="bankAccountName">
              <Input
                id="bankAccountName"
                name="bankAccountName"
                defaultValue={broker?.bankAccountName ?? ''}
              />
            </Field>
            <Field label={m.labelBankIban} name="bankIban">
              <Input
                id="bankIban"
                name="bankIban"
                dir="ltr"
                defaultValue={broker?.bankIban ?? ''}
              />
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-commission"
          number="04"
          title={m.panelCommissionTitle}
          description={m.panelCommissionDesc}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={m.labelCommPct}
                name="defaultCommissionPct"
                hint={m.hintCommPct}
              >
                <Input
                  id="defaultCommissionPct"
                  name="defaultCommissionPct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={pctValue(broker?.defaultCommissionPct)}
                />
              </Field>
              <Field label={m.labelCommModel} name="commissionModel">
                <Select
                  id="commissionModel"
                  name="commissionModel"
                  defaultValue={broker?.commissionModel ?? 'PERCENT_OF_SALE'}
                >
                  <option value="PERCENT_OF_SALE">{m.optionPercent}</option>
                  <option value="FIXED_PER_UNIT">{m.optionFixed}</option>
                  <option value="TIERED">{m.optionTiered}</option>
                </Select>
              </Field>
              <Field label={m.labelContractStart} name="contractStartAt">
                <Input
                  id="contractStartAt"
                  name="contractStartAt"
                  type="date"
                  defaultValue={dateInputValue(broker?.contractStartAt)}
                />
              </Field>
              <Field label={m.labelContractEnd} name="contractEndAt">
                <Input
                  id="contractEndAt"
                  name="contractEndAt"
                  type="date"
                  defaultValue={dateInputValue(broker?.contractEndAt)}
                />
              </Field>
            </div>
            <Field label={m.labelContractPdf} name="contractPdfUrl">
              <Input
                id="contractPdfUrl"
                name="contractPdfUrl"
                type="url"
                dir="ltr"
                placeholder="https://…"
                defaultValue={broker?.contractPdfUrl ?? ''}
              />
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-notes"
          number="05"
          title={m.panelNotesTitle}
          description={m.panelNotesDesc}
        >
          <Field label={m.labelNotes} name="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={broker?.notes ?? ''}
            />
          </Field>
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
