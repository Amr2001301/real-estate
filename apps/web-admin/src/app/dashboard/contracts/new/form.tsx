'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { Unit, User } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createContractAction, type ContractFormState } from '../actions';

interface Props {
  units:     Unit[];
  customers: User[];
  currency?: string;
  locale?:   Locale;
}

export default function ContractForm({ units, customers, currency = 'SAR', locale = 'ar' }: Props) {
  const m = uiT(locale).pages.contractsForm;
  const [state, formAction] = useActionState<ContractFormState, FormData>(
    createContractAction,
    {},
  );

  const NAV_SECTIONS = [
    { id: 'section-parties',   num: '01', label: m.navParties.label,   sub: m.navParties.sub },
    { id: 'section-financial', num: '02', label: m.navFinancial.label, sub: m.navFinancial.sub },
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
        navSections={NAV_SECTIONS}
        sidebarBadge={m.sidebarBadge}
        sidebarInfo={m.sidebarInfo}
      >
        <PremiumFormPanel
          id="section-parties"
          number="01"
          title={m.panelPartiesTitle}
          description={m.panelPartiesDesc}
        >
          <div className="flex flex-col gap-5">
            <Field label={m.labelCustomer} name="customerId">
              <select id="customerId" name="customerId" required defaultValue="" className={inputClass}>
                <option value="" disabled>{m.optionChoose}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.role}) {c.phone ? `· ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={m.labelUnit} name="unitId" hint={m.hintUnit}>
              <select id="unitId" name="unitId" required defaultValue="" className={inputClass}>
                <option value="" disabled>{m.optionChoose}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} · {tx(u.building?.phase?.project?.name)} · {formatCurrency(u.price, currency)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-financial"
          number="02"
          title={m.panelFinancialTitle}
          description={m.panelFinancialDesc}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.labelTotal} name="totalAmount">
                <input
                  id="totalAmount"
                  name="totalAmount"
                  type="number"
                  step="any"
                  min={0}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={m.labelDownPayment} name="downPayment">
                <input
                  id="downPayment"
                  name="downPayment"
                  type="number"
                  step="any"
                  min={0}
                  defaultValue={0}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={m.labelSignedAt} name="signedAt">
              <input id="signedAt" name="signedAt" type="datetime-local" className={inputClass} />
            </Field>

            <Field label={m.labelPdfUrl} name="pdfUrl">
              <input
                id="pdfUrl"
                name="pdfUrl"
                dir="ltr"
                placeholder="https://..."
                className={inputClass}
              />
            </Field>

            <p className="text-xs text-slate-500">{m.noteUpgrade}</p>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/contracts' as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
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
