'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ContractInstallment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { ActionTabs } from './action-tabs';
import {
  changeContractPriceAction,
  payInstallmentsAction,
  rescheduleContractAction,
  settleContractAction,
  waiveMarkupAction,
} from '../actions';

const INPUT =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const BTN =
  'h-10 rounded-xl bg-gradient-to-l from-brand-500 to-brand-600 px-6 text-sm font-bold text-[#1a1408] shadow-[0_8px_20px_-10px_rgba(201,162,77,0.8)] transition-opacity hover:opacity-90 disabled:opacity-50';
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
  const payable = open.filter((i) => !i.awaitingCheque && !i.awaitingPayment);
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
      <ActionTabs labels={[m.planPayManyTitle, m.planSettleTitle, m.planPriceTitle, m.planWaiveTitle, m.planRescheduleTitle]}>
        <form
          onSubmit={run(payInstallmentsAction, { installmentIds: picked.join(','), amount: String(pickedTotal) })}
          className="space-y-3"
        >
          <p className="text-[12.5px] leading-relaxed text-slate-500">{m.planPayManyHint}</p>
          <div className="max-h-60 divide-y divide-hairline overflow-y-auto rounded-2xl border border-hairline">
            {payable.map((i) => (
              <label key={i.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 transition-colors hover:bg-surface-muted/50 has-[:checked]:bg-brand-500/[0.07]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#c9a24d]"
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
          className="space-y-3"
        >
          <p className="text-[12.5px] leading-relaxed text-slate-500">{m.planSettleHint}</p>
          <p className="rounded-2xl border border-brand-500/25 bg-brand-500/[0.07] px-4 py-3 text-sm tabular-nums text-slate-900">
            {m.planSettleLeft} <strong>{formatCurrency(leftTotal, currency, locale)}</strong>
          </p>
          {methodSelect}
          <button type="submit" disabled={pending || payable.length === 0} className={BTN} data-testid="settle-submit">
            {m.planSettleBtn}
          </button>
        </form>

        <form onSubmit={run(changeContractPriceAction)} className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-slate-500">{m.planPriceHint}</p>
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

        <form onSubmit={run(waiveMarkupAction)} className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-slate-500">{m.planWaiveHint}</p>
          <input
            name="amount"
            type="number"
            required
            min={0.01}
            step="0.01"
            placeholder={m.planWaiveAmount}
            aria-label={m.planWaiveAmount}
            className={INPUT}
          />
          <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
          <button type="submit" disabled={pending || payable.length === 0} className={BTN} data-testid="waive-markup-submit">
            {m.planWaiveBtn}
          </button>
        </form>

        <form onSubmit={run(rescheduleContractAction)} className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-slate-500">{m.planRescheduleHint}</p>
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
      </ActionTabs>
      {error && <p className="rounded-xl bg-danger-500/10 px-4 py-2.5 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
