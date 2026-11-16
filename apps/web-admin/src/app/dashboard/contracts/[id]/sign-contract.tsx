'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { signContractAction } from '../actions';

// An unsigned contract (converted without a signing date) is signed here, on
// the date the customer signed — today, in the company's time zone, unless
// the admin picks another.
export function SignContract({
  contractId,
  today,
  initialDate,
  deliveryDefault,
  locale = 'ar',
  hasPlan = true,
}: {
  contractId: string;
  today: string;
  /** The signing date typed on the new-contract form, carried here. */
  initialDate?: string;
  /** The unit's handover date now — what the contract promises unless changed. */
  deliveryDefault?: string | null;
  locale?: Locale;
  /** The contract has a payment plan (instalments or cash); without one it cannot be signed. */
  hasPlan?: boolean;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [date, setDate] = useState(initialDate ?? today);
  const [delivery, setDelivery] = useState(deliveryDefault ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sign() {
    if (!date || !window.confirm(m.signConfirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await signContractAction(contractId, date, delivery || undefined);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (!hasPlan) {
    return (
      <p className="mt-2 text-xs text-warning-700" data-testid="sign-needs-plan">
        {m.signNeedsPlan}
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="sign-contract">
      <input
        type="date"
        aria-label={m.signDateLabel}
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 rounded-lg border border-hairline bg-surface px-2 text-xs"
      />
      <input
        type="date"
        name="deliveryDate"
        aria-label={m.deliverySignHint}
        title={m.deliverySignHint}
        value={delivery}
        onChange={(e) => setDelivery(e.target.value)}
        className="h-8 rounded-lg border border-hairline bg-surface px-2 text-xs"
      />
      <button
        type="button"
        onClick={sign}
        disabled={pending || !date}
        className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {m.signBtn}
      </button>
      {error && <p className="w-full text-xs text-danger-700">{error}</p>}
    </div>
  );
}
