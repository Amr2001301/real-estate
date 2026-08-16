'use client';

import Link from 'next/link';
import { useActionState, useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Field, inputClass } from '@/components/form/field';
import { SubmitButton } from '@/components/form/submit-button';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { MediaUploader } from '@/components/media-uploader';
import { PremiumFormLayout, PremiumFormPanel } from '@/components/premium';
import type { Contract, ContractInstallment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { recordDepositAction, type DepositFormState } from '../actions';

interface Props {
  contracts:          Contract[];
  initialContractId?: string;
  currency?:          string;
  locale?:            Locale;
}

export default function RecordDepositForm({ contracts, initialContractId, currency = 'SAR', locale = 'ar' }: Props) {
  const m = uiT(locale).pages.depositsForm;
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

  const NAV_SECTIONS = [
    { id: 'section-contract', num: '01', label: m.navContract.label, sub: m.navContract.sub },
    { id: 'section-payment',  num: '02', label: m.navPayment.label,  sub: m.navPayment.sub },
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4 lg:gap-5">
      <input type="hidden" name="receiptUrl" value={receiptUrl} />

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
          id="section-contract"
          number="01"
          title={m.panelContractTitle}
          description={m.panelContractDesc}
        >
          <div className="flex flex-col gap-5">
            <Field label={m.labelContract} name="contractId">
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
                <option value="" disabled>{m.optionChoose}</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractNumber ?? `#${c.id.slice(0, 8)}`} · {c.customer?.fullName ?? '—'} ·{' '}
                    {formatCurrency(c.totalAmount, currency)}
                  </option>
                ))}
              </select>
            </Field>

            {contractId && (
              <Field label={m.labelInstallment} name="installmentId">
                {loadingInst ? (
                  <p className="text-sm text-slate-400 py-2">{m.loadingInstallments}</p>
                ) : installments.length === 0 ? (
                  <p className="text-sm text-amber-600 py-2">{m.noInstallments}</p>
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
                    <option value="" disabled>{m.optionChooseInstallment}</option>
                    {installments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {formatDate(inst.dueDate)} — {formatCurrency(inst.amount, currency)} —{' '}
                        {inst.status === 'OVERDUE' ? m.statusOverdue : m.statusPending}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>
        </PremiumFormPanel>

        <PremiumFormPanel
          id="section-payment"
          number="02"
          title={m.panelPaymentTitle}
          description={m.panelPaymentDesc}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={m.labelAmount} name="amount">
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
              <Field label={m.labelPaidAt} name="paidAt">
                <input
                  id="paidAt"
                  name="paidAt"
                  type="datetime-local"
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={m.labelReceipt} name="receiptUrl_display">
              {receiptUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {m.previewReceipt}
                  </a>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl('')}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {m.removeReceipt}
                  </button>
                </div>
              ) : (
                <MediaUploader
                  folder="receipts"
                  accept="application/pdf,image/*"
                  buttonLabel={m.uploadReceipt}
                  onUploaded={(url) => setReceiptUrl(url)}
                />
              )}
            </Field>
          </div>
        </PremiumFormPanel>
      </PremiumFormLayout>

      <FormFooter
        sticky
        primary={
          <>
            <Link href={'/dashboard/deposits' as never}>
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
