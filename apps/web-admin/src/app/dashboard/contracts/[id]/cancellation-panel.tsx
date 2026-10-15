'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import type { ContractCancellationView } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { inputClass } from '@/components/form/field';
import { uiT } from '@/messages/ui';
import { recordRefundAction, releaseContractUnitAction } from '../actions';

// A cancelled contract: what was agreed, what was paid back, and the two
// follow-ups — paying the rest of the refund and putting the unit back on sale.
export function CancellationPanel({
  id,
  cancellation: c,
  currency,
  canManage,
  locale = 'ar',
}: {
  id: string;
  cancellation: ContractCancellationView;
  currency: string;
  canManage: boolean;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const money = (v: string | number) => formatCurrency(v, currency, locale);
  const owed = Number(c.refundOutstanding);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={strong ? 'text-[15px] font-bold tabular-nums text-slate-900' : 'text-[13px] text-slate-800'}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="cancellation-panel">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {row(m.cancellationDate, formatDate(c.cancellationDate, locale))}
        {row(m.cancellationBy, c.cancelledBy?.fullName ?? '—')}
        {row(m.cancellationCollected, money(c.totalCollectedSnapshot), true)}
        {row(m.cancellationRetained, money(c.retainedAmount), true)}
        {row(m.cancellationRefund, money(c.refundAmount), true)}
        {row(m.cancellationRefunded, money(c.refundedTotal), true)}
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-[11px] text-slate-400">{m.cancellationOutstanding}</p>
        <p data-testid="refund-outstanding" className={owed > 0 ? 'text-lg font-bold tabular-nums text-warning-700' : 'text-lg font-bold tabular-nums text-success-700'}>
          {money(c.refundOutstanding)}
        </p>
      </div>
      {row(m.cancellationReason, c.reason)}

      <div>
        <h4 className="mb-2 text-[13px] font-bold text-slate-800">{m.refundsTitle}</h4>
        {c.refunds.length === 0 ? (
          <p className="text-xs text-slate-500">{m.noRefunds}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline">
            {c.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span className="font-semibold tabular-nums">{money(r.amount)}</span>
                <span className="text-slate-600">{m.refundMethods[r.paymentMethod]}{r.referenceNumber ? ` · ${r.referenceNumber}` : ''}</span>
                <span className="text-slate-500">{formatDate(r.paidAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && owed > 0 && (
        <form
          action={(fd) => run(() => recordRefundAction(id, fd))}
          data-testid="record-refund-form"
          className="space-y-3 rounded-xl border border-hairline p-3"
        >
          <h4 className="text-[13px] font-bold text-slate-800">{m.refundRecord}</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-[13px] text-slate-700">
              {m.refundAmount}
              <input name="amount" type="number" min={0.01} max={owed} step="0.01" required defaultValue={owed} className={inputClass} />
            </label>
            <label className="block text-[13px] text-slate-700">
              {m.refundMethod}
              <select name="paymentMethod" required defaultValue="BANK_TRANSFER" className={inputClass}>
                {(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const).map((k) => (
                  <option key={k} value={k}>{m.refundMethods[k]}</option>
                ))}
              </select>
            </label>
            <label className="block text-[13px] text-slate-700">
              {m.refundDate}
              <input name="paidAt" type="date" className={inputClass} />
            </label>
            <label className="block text-[13px] text-slate-700">
              {m.refundReference}
              <input name="referenceNumber" maxLength={100} className={inputClass} />
            </label>
            <label className="block text-[13px] text-slate-700">
              {m.refundBank}
              <input name="bankName" maxLength={200} className={inputClass} />
            </label>
            <label className="block text-[13px] text-slate-700">
              {m.refundNotes}
              <input name="notes" maxLength={2000} className={inputClass} />
            </label>
          </div>
          <button type="submit" disabled={pending} className="h-9 rounded-xl bg-brand-600 px-4 text-[13px] font-semibold text-white disabled:opacity-50">
            {m.refundSubmit}
          </button>
        </form>
      )}

      {c.unitReleasedAt ? (
        <p className="text-xs text-success-700">{m.unitReleased} · {formatDate(c.unitReleasedAt, locale)}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-600">{m.unitStillSold}</p>
          {canManage && (
            <button
              type="button"
              data-testid="release-unit"
              disabled={pending}
              onClick={() => run(() => releaseContractUnitAction(id))}
              className="h-8 rounded-lg border border-hairline bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {m.releaseUnit}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger-700">{error}</p>}
    </div>
  );
}
