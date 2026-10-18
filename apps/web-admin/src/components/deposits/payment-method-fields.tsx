'use client';

import { useState } from 'react';
import { Field, inputClass } from '@/components/form/field';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

/**
 * Payment method, with the cheque or transfer details it needs. Shared by the
 * "تسجيل دفعة" page and the contract page's per-row "سجّل دفعة", which had no
 * method at all (its payments were saved with none).
 */
export function PaymentMethodFields({ locale = 'ar' }: { locale?: Locale }) {
  const m = uiT(locale).pages.depositsForm;
  const [method, setMethod] = useState('');
  return (
    <>
      <Field label={m.labelMethod} name="paymentMethod">
        <select
          id="paymentMethod"
          name="paymentMethod"
          required
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>{m.optionChoose}</option>
          {(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const).map((k) => (
            <option key={k} value={k}>{m.methodLabels[k]}</option>
          ))}
        </select>
      </Field>

      {/* FG-01 — a cheque stays unpaid until it clears on the Cheques page. */}
      {method === 'CHEQUE' && (
        <div className="flex flex-col gap-4 rounded-xl border border-warning-100 bg-warning-50/40 p-4">
          <p className="text-xs text-warning-700">{m.chequeNote}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={m.labelChequeNumber} name="chequeNumber">
              <input id="chequeNumber" name="chequeNumber" required maxLength={100} className={inputClass} />
            </Field>
            <Field label={m.labelDrawerBank} name="drawerBankName">
              <input id="drawerBankName" name="drawerBankName" maxLength={200} className={inputClass} />
            </Field>
            <Field label={m.labelChequeDueDate} name="chequeDueDate">
              <input id="chequeDueDate" name="chequeDueDate" type="date" required className={inputClass} />
            </Field>
          </div>
        </div>
      )}

      {method === 'BANK_TRANSFER' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">{m.transferNote}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={m.labelTransferBank} name="transferBank">
              <input id="transferBank" name="transferBank" maxLength={200} className={inputClass} />
            </Field>
            <Field label={m.labelTransferRef} name="transferRef">
              <input id="transferRef" name="transferRef" maxLength={100} className={inputClass} />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}
