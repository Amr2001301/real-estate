'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormSection } from '@/components/ui/form-section';
import { FormFooter } from '@/components/ui/form-footer';
import { tx, formatCurrency } from '@/lib/format';
import type { PortalLead, PortalUnit } from '@/lib/types';
import {
  createPortalReservationAction,
  type PortalReservationFormState,
} from './actions';

interface Props {
  approvedLeads: PortalLead[];
  units: PortalUnit[];
}

export default function PortalReservationForm({ approvedLeads, units }: Props) {
  const [state, formAction] = useActionState<PortalReservationFormState, FormData>(
    createPortalReservationAction,
    {},
  );

  // Leads with no assigned sales handler can't proceed — flag them so the
  // broker doesn't waste effort.
  const leadsMissingSales = approvedLeads.filter((l) => !l.assignedSalesId);

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:gap-8">
      {state.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">{state.error}</p>
        </div>
      )}

      {leadsMissingSales.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              بعض الفرص المعتمدة لا يوجد بها مندوب مبيعات داخلي بعد:
            </p>
            <ul className="mt-1 list-disc ps-5 space-y-0.5 text-xs">
              {leadsMissingSales.slice(0, 5).map((l) => (
                <li key={l.id}>
                  {l.fullName} — {l.phone}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs">
              تواصل مع الإدارة لتعيين مندوب قبل إنشاء الحجز.
            </p>
          </div>
        </div>
      )}

      <FormSection
        title="الفرصة والوحدة"
        description="الحجز يتطلب فرصة معتمدة + وحدة متاحة + مندوب مبيعات داخلي مُعيَّن على الفرصة."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="الفرصة" name="leadId" required hint="فرص معتمدة فقط">
            <Select id="leadId" name="leadId" required defaultValue="">
              <option value="" disabled>
                اختر فرصة
              </option>
              {approvedLeads.map((l) => (
                <option
                  key={l.id}
                  value={l.id}
                  disabled={!l.assignedSalesId}
                >
                  {l.fullName} • {l.phone}
                  {l.assignedSalesId
                    ? l.assignedSales
                      ? ` — مندوب: ${l.assignedSales.fullName}`
                      : ''
                    : ' — (بدون مندوب)'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الوحدة" name="unitId" required hint="وحدات متاحة فقط">
            <Select id="unitId" name="unitId" required defaultValue="">
              <option value="" disabled>
                اختر وحدة
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} • {tx(u.building.phase.project.name)} —{' '}
                  {formatCurrency(u.price)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="ملاحظات" description="معلومات إضافية لمندوب المبيعات الداخلي.">
        <Field label="ملاحظة" name="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>
      </FormSection>

      <FormFooter
        sticky
        primary={
          <>
            <Link href="/portal/reservations">
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>إنشاء الحجز</SubmitButton>
          </>
        }
        helper="سيتم احتساب نسبة العمولة وحفظها كلقطة (snapshot) عند الإنشاء."
      />
    </form>
  );
}
