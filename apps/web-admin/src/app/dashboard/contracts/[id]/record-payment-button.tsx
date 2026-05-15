'use client';

import { useState, useTransition } from 'react';
import { CreditCard, X } from 'lucide-react';
import { Field, inputClass } from '@/components/form/field';
import { Button } from '@/components/ui/button';
import { recordInstallmentPaymentAction } from '../actions';
import { formatCurrency, formatDate } from '@/lib/format';

interface Props {
  contractId: string;
  installmentId: string;
  amount: string | number;
  dueDate: string;
}

export function RecordPaymentButton({ contractId, installmentId, amount, dueDate }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
      >
        <CreditCard className="h-3 w-3" />
        سجّل دفعة
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await recordInstallmentPaymentAction(contractId, installmentId, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <div className="mt-1 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-brand-800 text-xs">تسجيل دفعة — القسط {formatDate(dueDate)}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="amount" value={String(amount)} />
        <div className="text-xs text-slate-600">
          المبلغ: <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
          <span className="text-slate-400 mr-1">(ثابت)</span>
        </div>

        <Field label="تاريخ الدفع" name="paidAt">
          <input
            id="paidAt"
            name="paidAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            className={inputClass}
          />
        </Field>

        <Field label="إيصال الدفع (URL اختياري)" name="receiptUrl">
          <input
            id="receiptUrl"
            name="receiptUrl"
            type="url"
            placeholder="https://..."
            className={inputClass}
          />
        </Field>

        {error && (
          <div className="rounded bg-red-50 text-red-700 p-2 text-xs">{error}</div>
        )}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={isPending}>
            {isPending ? 'جاري...' : 'تأكيد الدفع'}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
