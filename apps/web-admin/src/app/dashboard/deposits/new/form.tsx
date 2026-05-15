'use client';

import { useActionState, useState, useEffect } from 'react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { MediaUploader } from '@/components/media-uploader';
import type { Contract, ContractInstallment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
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
  const [contractId, setContractId] = useState(initialContractId ?? '');
  const [installments, setInstallments] = useState<ContractInstallment[]>([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!contractId) {
      setInstallments([]);
      setSelectedInstallmentId('');
      setAmount('');
      return;
    }
    setLoadingInst(true);
    fetch(`/api/installments?contractId=${contractId}`)
      .then((r) => r.json())
      .then((d) => {
        const rows: ContractInstallment[] = d?.data ?? [];
        setInstallments(rows);
        const first = rows[0];
        setSelectedInstallmentId(first?.id ?? '');
        setAmount(first ? String(first.amount) : '');
      })
      .catch(() => {
        setInstallments([]);
        setSelectedInstallmentId('');
        setAmount('');
      })
      .finally(() => setLoadingInst(false));
  }, [contractId]);

  const selectedInstallment = installments.find((i) => i.id === selectedInstallmentId);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="receiptUrl" value={receiptUrl} />

      <Field label="العقد" name="contractId">
        <select
          id="contractId"
          name="contractId"
          required
          value={contractId}
          onChange={(e) => {
            setContractId(e.target.value);
            setSelectedInstallmentId('');
          }}
          className={inputClass}
        >
          <option value="" disabled>
            — اختر —
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contractNumber ?? `#${c.id.slice(0, 8)}`} · {c.customer?.fullName ?? '—'} ·{' '}
              {formatCurrency(c.totalAmount)}
            </option>
          ))}
        </select>
      </Field>

      {contractId && (
        <Field label="القسط" name="installmentId">
          {loadingInst ? (
            <p className="text-sm text-slate-400 py-2">جاري التحميل…</p>
          ) : installments.length === 0 ? (
            <p className="text-sm text-amber-600 py-2">لا توجد أقساط معلقة لهذا العقد</p>
          ) : (
            <select
              id="installmentId"
              name="installmentId"
              required
              value={selectedInstallmentId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedInstallmentId(id);
                const inst = installments.find((i) => i.id === id);
                setAmount(inst ? String(inst.amount) : '');
              }}
              className={inputClass}
            >
              <option value="" disabled>
                — اختر القسط —
              </option>
              {installments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {formatDate(inst.dueDate)} — {formatCurrency(inst.amount)} —{' '}
                  {inst.status === 'OVERDUE' ? 'متأخر' : 'قيد الانتظار'}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="المبلغ" name="amount">
          <input
            id="amount"
            name="amount"
            type="number"
            step="any"
            min={0}
            required
            readOnly={!!selectedInstallment}
            value={amount}
            onChange={(e) => {
              if (!selectedInstallment) setAmount(e.target.value);
            }}
            className={`${inputClass} ${selectedInstallment ? 'bg-slate-50 text-slate-500' : ''}`}
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

      <Field label="إيصال الدفع (PDF)" name="receiptUrl_display">
        {receiptUrl ? (
          <div className="flex items-center gap-2">
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:underline"
            >
              معاينة الإيصال
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
