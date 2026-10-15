'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import type { CancellationSuggestion } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { inputClass } from '@/components/form/field';
import { uiT } from '@/messages/ui';
import { cancelContractAction } from '../actions';

// Cancelling a contract: the amounts are pre-filled from the company's
// cancellation policy and the admin settles them before confirming.
export function CancelContract({
  id,
  suggestion,
  currency,
  locale = 'ar',
}: {
  id: string;
  suggestion: CancellationSuggestion;
  currency: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = suggestion.policySnapshot;

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await cancelContractAction(id, formData);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="cancel-contract-open"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-danger-100 bg-white px-3 py-2 text-[13px] font-semibold text-danger-700 hover:bg-danger-50"
      >
        <Ban className="h-4 w-4" />
        {m.cancelOpen}
      </button>
    );
  }

  const actions = [
    ['CLAWBACK', m.actionClawback],
    ['RETAIN', m.actionRetain],
    ['MANUAL', m.actionManual],
  ] as const;

  return (
    <form action={submit} data-testid="cancel-contract-form" className="space-y-4 rounded-2xl border border-danger-100 bg-danger-50/40 p-4">
      <div>
        <h3 className="text-[15px] font-bold text-danger-700">{m.cancelTitle}</h3>
        <p className="mt-1 text-xs text-slate-600">{m.cancelHint}</p>
      </div>
      <p className="text-[13px] text-slate-700">
        {m.cancelCollected}:{' '}
        <span className="font-bold tabular-nums">{formatCurrency(suggestion.totalCollected, currency, locale)}</span>
      </p>
      <p className="text-xs text-slate-500">{m.cancelSuggested}</p>

      <label className="block text-[13px] font-medium text-slate-700">
        {m.cancelReason}
        <textarea name="reason" required maxLength={2000} rows={2} className={inputClass} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-medium text-slate-700">
          {m.cancelRetained}
          <input name="retainedAmount" type="number" min={0} step="0.01" required defaultValue={suggestion.suggestedRetained} className={inputClass} />
        </label>
        <label className="block text-[13px] font-medium text-slate-700">
          {m.cancelRefund}
          <input name="refundAmount" type="number" min={0} step="0.01" required defaultValue={suggestion.suggestedRefund} className={inputClass} />
        </label>
      </div>
      <label className="block text-[13px] font-medium text-slate-700">
        {m.cancelNotes}
        <textarea name="financialNotes" maxLength={2000} rows={2} className={inputClass} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-[13px] font-medium text-slate-700">
          {m.cancelUnit}
          <select name="unitRelease" defaultValue={p.unitRelease} className={inputClass}>
            <option value="AUTO">{m.cancelUnitAuto}</option>
            <option value="REQUIRES_APPROVAL">{m.cancelUnitApproval}</option>
          </select>
        </label>
        <label className="block text-[13px] font-medium text-slate-700">
          {m.cancelCommission}
          <select name="commissionAction" defaultValue={p.commissionAction} className={inputClass}>
            {actions.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-slate-700">
          {m.cancelBonus}
          <select name="bonusAction" defaultValue={p.bonusAction} className={inputClass}>
            {actions.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-slate-700">
        <input type="checkbox" name="demoteCustomer" defaultChecked={p.demoteClient} />
        {m.cancelDemote}
      </label>

      {error && <p className="text-xs text-danger-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-xl bg-danger-600 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {m.cancelConfirm}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="h-9 rounded-xl border border-hairline bg-white px-4 text-[13px] font-semibold text-slate-700"
        >
          {m.cancelBack}
        </button>
      </div>
    </form>
  );
}
