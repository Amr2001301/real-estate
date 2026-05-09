'use client';

import { useActionState, useState } from 'react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { MediaUploader } from '@/components/media-uploader';
import type { Contract } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { recordDepositAction, type DepositFormState } from '../actions';

interface Props {
  contracts: Contract[];
  initialContractId?: string;
}

export default function RecordDepositForm({ contracts, initialContractId }: Props) {
  const [state, formAction] = useActionState<DepositFormState, FormData>(
    recordDepositAction,
    {},
  );
  const [receiptUrl, setReceiptUrl] = useState('');

  return (
    <form action={formAction} className="space-y-4">
      <Field label="العقد" name="contractId">
        <select
          id="contractId"
          name="contractId"
          required
          defaultValue={initialContractId ?? ''}
          className={inputClass}
        >
          <option value="" disabled>
            — اختر —
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.id.slice(0, 8)} · {c.customer?.fullName ?? '—'} · {formatCurrency(c.totalAmount)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="المبلغ" name="amount">
          <input
            id="amount"
            name="amount"
            type="number"
            step="any"
            min={0}
            required
            className={inputClass}
          />
        </Field>
        <Field label="تاريخ الدفع" name="paidAt">
          <input
            id="paidAt"
            name="paidAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="إيصال الدفع (PDF)" name="receiptUrl">
        <input
          type="hidden"
          id="receiptUrl"
          name="receiptUrl"
          value={receiptUrl}
          readOnly
        />
        {receiptUrl ? (
          <div className="flex items-center gap-2">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              📄 معاينة الإيصال
            </a>
            <button
              type="button"
              onClick={() => setReceiptUrl('')}
              className="text-xs text-red-600 hover:underline"
            >
              إزالة
            </button>
          </div>
        ) : (
          <MediaUploader
            folder="receipts"
            accept="application/pdf,image/*"
            buttonLabel="+ رفع إيصال"
            onUploaded={(url) => setReceiptUrl(url)}
          />
        )}
      </Field>

      {state.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{state.error}</div>
      )}

      <SubmitButton>تسجيل الدفعة</SubmitButton>
    </form>
  );
}
