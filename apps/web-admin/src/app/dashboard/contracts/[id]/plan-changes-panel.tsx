'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ContractInstallment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  changeContractPriceAction,
  payInstallmentsAction,
  rescheduleContractAction,
  settleContractAction,
} from '../actions';

const INPUT = 'h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm';
const BTN = 'h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50';
const cents = (v: string | number) => Math.round(Number(v) * 100);

// Money changes on a live contract: one payment for several installments,
// early settlement, a new price (e.g. a discount), and a new schedule for
// the unpaid monthly installments.
export function PlanChangesPanel({
  contractId,
  totalAmount,
  open,
  currency,
  locale = 'ar',
}: {
  contractId: string;
  totalAmount: string | number;
  open: ContractInstallment[];
  currency: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const payable = open.filter((i) => !i.awaitingCheque);
  const pickedTotal = useMemo(
    () => payable.filter((i) => picked.includes(i.id)).reduce((a, i) => a + cents(i.amount), 0) / 100,
    [payable, picked],
  );
  const leftTotal = payable.reduce((a, i) => a + cents(i.amount), 0) / 100;

  function run(action: (id: string, data: FormData) => Promise<{ error?: string }>, extra?: Record<string, string>) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!window.confirm(m.amendConfirm)) return;
      const form = e.currentTarget;
      const data = new FormData(form);
      for (const [k, v] of Object.entries(extra ?? {})) data.set(k, v);
      setError(null);
      startTransition(async () => {
        const res = await action(contractId, data);
        if (res.error) setError(res.error);
        else {
          form.reset();
          setPicked([]);
          router.refresh();
        }
      });
    };
  }

  const methodSelect = (
    <select
      name="paymentMethod"
      value={method}
      onChange={(e) => setMethod(e.target.value as 'CASH' | 'BANK_TRANSFER')}
      className={INPUT}
      aria-label={m.planPayMethod}
    >
      <option value="CASH">{m.planMethodCash}</option>
      <option value="BANK_TRANSFER">{m.planMethodTransfer}</option>
    </select>
  );

  return (
    <div className="space-y-4" data-testid="plan-changes">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form
          onSubmit={run(payInstallmentsAction, { installmentIds: picked.join(','), amount: String(pickedTotal) })}
          className="space-y-3 rounded-xl border border-hairline p-4"
        >
          <p className="text-sm font-bold text-slate-900">{m.planPayManyTitle}</p>
          <p className="text-[12px] text-slate-500">{m.planPayManyHint}</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {payable.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  checked={picked.includes(i.id)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, i.id] : p.filter((x) => x !== i.id)))
                  }
                />
                <span className="tabular-nums">{formatDate(i.dueDate, locale)}</span>
                <span className="ms-auto tabular-nums font-semibold">{formatCurrency(i.amount, currency, locale)}</span>
              </label>
            ))}
          </div>
          {methodSelect}
          <button type="submit" disabled={pending || picked.length === 0} className={BTN} data-testid="pay-many-submit">
            {m.planPayManyBtn} {picked.length > 0 ? formatCurrency(pickedTotal, currency, locale) : ''}
          </button>
        </form>

        <form
          onSubmit={run(settleContractAction, { amount: String(leftTotal) })}
          className="space-y-3 rounded-xl border border-hairline p-4"
        >
          <p className="text-sm font-bold text-slate-900">{m.planSettleTitle}</p>
          <p className="text-[12px] text-slate-500">{m.planSettleHint}</p>
          <p className="text-sm tabular-nums text-slate-900">
            {m.planSettleLeft} <strong>{formatCurrency(leftTotal, currency, locale)}</strong>
          </p>
          {methodSelect}
          <button type="submit" disabled={pending || payable.length === 0} className={BTN} data-testid="settle-submit">
            {m.planSettleBtn}
          </button>
        </form>

        <form onSubmit={run(changeContractPriceAction)} className="space-y-3 rounded-xl border border-hairline p-4">
          <p className="text-sm font-bold text-slate-900">{m.planPriceTitle}</p>
          <p className="text-[12px] text-slate-500">{m.planPriceHint}</p>
          <input
            name="totalAmount"
            type="number"
            required
            min={1}
            step="0.01"
            defaultValue={Number(totalAmount)}
            aria-label={m.planPriceNew}
            className={INPUT}
          />
          <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
          <button type="submit" disabled={pending} className={BTN} data-testid="price-submit">
            {m.planPriceBtn}
          </button>
        </form>

        <form onSubmit={run(rescheduleContractAction)} className="space-y-3 rounded-xl border border-hairline p-4">
          <p className="text-sm font-bold text-slate-900">{m.planRescheduleTitle}</p>
          <p className="text-[12px] text-slate-500">{m.planRescheduleHint}</p>
          <input
            name="months"
            type="number"
            required
            min={1}
            max={600}
            step={1}
            placeholder={m.planRescheduleMonths}
            aria-label={m.planRescheduleMonths}
            className={INPUT}
          />
          <label className="block text-[12px] font-semibold text-slate-700">{m.planRescheduleStart}</label>
          <input name="startsAt" type="date" required className={INPUT} />
          <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
          <button type="submit" disabled={pending} className={BTN} data-testid="reschedule-submit">
            {m.planRescheduleBtn}
          </button>
        </form>
      </div>
      {error && <p className="text-sm text-danger-700">{error}</p>}
    </div>
  );
}
