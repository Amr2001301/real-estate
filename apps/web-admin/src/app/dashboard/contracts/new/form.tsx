'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { SearchSelect } from '@/components/form/search-select';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { Unit, User } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { createContractAction, type ContractFormState } from '../actions';

interface Props {
  currency?: string;
  locale?:   Locale;
}

// Customers and units are searched on the server (SearchSelect): this form
// used to preload ?pageSize=100 of each, so customer or unit 101 could not be
// put on a contract.
export default function ContractForm({ currency = 'SAR', locale = 'ar' }: Props) {
  const m = uiT(locale).pages.contractsForm;
  const c = uiT(locale).common;
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
              <SearchSelect<User>
                name="customerId"
                required
                endpoint="/api-proxy/users?role=CLIENT,CUSTOMER"
                toOption={(u) => ({
                  id: u.id,
                  label: `${u.fullName} (${u.role})${u.phone ? ` · ${u.phone}` : ''}`,
                  raw: u,
                })}
                placeholder={c.searchClientPlaceholder}
                locale={locale}
              />
            </Field>

            <Field label={m.labelUnit} name="unitId" hint={m.hintUnit}>
              <SearchSelect<Unit>
                name="unitId"
                required
                endpoint="/api-proxy/units?status=AVAILABLE"
                toOption={(u) => ({
                  id: u.id,
                  label: `${u.code} · ${tx(u.building?.phase?.project?.name)} · ${formatCurrency(u.price, currency, locale)}`,
                  raw: u,
                })}
                placeholder={c.searchUnitPlaceholder}
                locale={locale}
              />
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

            {/* FG-04 — empty → the next CON-<year>-<seq> is assigned. */}
            <Field label={m.labelContractNumber} name="contractNumber" hint={m.hintContractNumber}>
              <input id="contractNumber" name="contractNumber" dir="ltr" maxLength={50} className={inputClass} />
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
