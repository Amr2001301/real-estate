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
import { createContractAction, type ContractFormState } from '../actions';

const NAV_SECTIONS = [
  { id: 'section-parties',   num: '01', label: 'العميل والوحدة',            sub: 'الطرفان الرئيسيان في العقد' },
  { id: 'section-financial', num: '02', label: 'القيم المالية والتوقيع',    sub: 'المبالغ والتواريخ والمرفق' },
];

interface Props {
  units: Unit[];
  customers: User[];
}

export default function ContractForm({ units, customers }: Props) {
  const [state, formAction] = useActionState<ContractFormState, FormData>(
    createContractAction,
    {},
  );

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
        sidebarBadge="جديد"
        sidebarInfo="إنشاء العقد سيرقّي العميل إلى Customer ويحوّل حالة الوحدة إلى مباعة."
      >
        <PremiumFormPanel
          id="section-parties"
          number="01"
          title="العميل والوحدة"
          description="حدد الطرفين الرئيسيين في العقد: العميل والوحدة العقارية."
        >
          <div className="flex flex-col gap-5">
            <Field label="العميل (Client / Customer)" name="customerId">
              <select id="customerId" name="customerId" required defaultValue="" className={inputClass}>
                <option value="" disabled>— اختر —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.role}) {c.phone ? `· ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="الوحدة" name="unitId" hint="فقط الوحدات المتاحة تظهر هنا">
              <select id="unitId" name="unitId" required defaultValue="" className={inputClass}>
                <option value="" disabled>— اختر —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} · {tx(u.building?.phase?.project?.name)} · {formatCurrency(u.price)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-financial"
          number="02"
          title="القيم المالية والتوقيع"
          description="أدخل إجمالي العقد والدفعة الأولى وتاريخ التوقيع ورابط ملف العقد."
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="إجمالي العقد" name="totalAmount">
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
              <Field label="الدفعة المقدمة" name="downPayment">
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

            <Field label="تاريخ التوقيع (اختياري)" name="signedAt">
              <input id="signedAt" name="signedAt" type="datetime-local" className={inputClass} />
            </Field>

            <Field label="رابط ملف العقد PDF (اختياري — يمكن رفعه لاحقًا)" name="pdfUrl">
              <input
                id="pdfUrl"
                name="pdfUrl"
                dir="ltr"
                placeholder="https://..."
                className={inputClass}
              />
            </Field>

            <p className="text-xs text-slate-500">
              ملاحظة: إنشاء العقد سيقوم بترقية العميل إلى Customer وتغيير حالة الوحدة إلى مباعة.
            </p>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/contracts' as never}>
              <Button type="button" variant="ghost" leftIcon={<X className="h-4 w-4" />}>
                إلغاء
              </Button>
            </Link>
            <SubmitButton>إنشاء العقد</SubmitButton>
          </>
        }
        helper="سيتم إنشاء العقد فور الحفظ وتحديث حالة الوحدة والعميل."
      />
    </form>
  );
}
