'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { setContractDeliveryAction } from '../actions';

/**
 * F10 — the handover date the contract promises, against the one expected
 * now (the unit's, or its phase's): late shows how many days. The admin can
 * correct the contract's date to what was agreed.
 */
export function ContractDeliveryDate({
  contractId,
  deliveryDate,
  expected,
  delayDays,
  editable,
  locale = 'ar',
}: {
  contractId: string;
  deliveryDate: string | null;
  expected: string | null;
  delayDays: number;
  editable: boolean;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [date, setDate] = useState(deliveryDate?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setContractDeliveryAction(contractId, date);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 text-[13px]" data-testid="contract-delivery">
      <span className="text-slate-700">
        {m.deliveryContract}: <b>{deliveryDate?.slice(0, 10) ?? m.deliveryNone}</b>
      </span>
      <span className="text-slate-500">
        {m.deliveryExpected}: {expected ?? m.deliveryNone}
      </span>
      {deliveryDate && expected && (
        <span
          data-testid="contract-delivery-status"
          className={delayDays > 0 ? 'font-semibold text-danger-700' : 'font-semibold text-success-700'}
        >
          {delayDays > 0 ? m.deliveryLate.replace('{n}', String(delayDays)) : m.deliveryOnTime}
        </span>
      )}
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label={m.deliveryContract}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 rounded-lg border border-hairline bg-surface px-2 text-xs"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-8 rounded-lg border border-hairline px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {m.deliverySave}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger-700">{error}</p>}
    </div>
  );
}
