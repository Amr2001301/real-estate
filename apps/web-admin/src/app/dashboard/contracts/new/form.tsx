'use client';

import { useActionState } from 'react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import type { Unit, User } from '@/lib/types';
import { tx, formatCurrency } from '@/lib/format';
import { createContractAction, type ContractFormState } from '../actions';

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
    <form action={formAction} className="space-y-4">
      <Field label="العميل (Client / Customer)" name="customerId">
        <select id="customerId" name="customerId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            — اختر —
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName} ({c.role}) {c.phone ? `· ${c.phone}` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="الوحدة" name="unitId" hint="فقط الوحدات المتاحة تظهر هنا">
        <select id="unitId" name="unitId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            — اختر —
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} · {tx(u.building?.phase?.project?.name)} · {formatCurrency(u.price)}
            </option>
          ))}
        </select>
      </Field>

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

      {state.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{state.error}</div>
      )}

      <p className="text-xs text-gray-500">
        ملاحظة: إنشاء العقد سيقوم بترقية العميل إلى Customer وتغيير حالة الوحدة إلى مباعة.
      </p>

      <SubmitButton>إنشاء العقد</SubmitButton>
    </form>
  );
}
