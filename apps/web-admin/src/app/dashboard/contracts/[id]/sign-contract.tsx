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
  locale = 'ar',
}: {
  contractId: string;
  today: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sign() {
    if (!date || !window.confirm(m.signConfirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await signContractAction(contractId, date);
      if (res.error) setError(res.error);
      else router.refresh();
    });
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
