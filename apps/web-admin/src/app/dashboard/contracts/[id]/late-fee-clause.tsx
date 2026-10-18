'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { setLateFeeClauseAction } from '../actions';

// The contract's late-fee clause: the late-fee sweep charges only contracts
// that have one. The admin sets it as the signed contract says.
export function LateFeeClause({
  contractId,
  applies,
  editable,
  locale = 'ar',
}: {
  contractId: string;
  applies: boolean;
  editable: boolean;
  locale?: Locale;
}) {
  const m = uiT(locale).common.lateFeeClause;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = await setLateFeeClauseAction(contractId, !applies);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div data-testid="late-fee-clause" className="flex flex-wrap items-center gap-2">
      <span
        className={
          applies ? 'text-[13px] font-semibold text-slate-800' : 'text-[13px] text-slate-500'
        }
      >
        {applies ? m.on : m.off}
      </span>
      {editable && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="text-xs font-medium text-brand-600 hover:text-brand-800 disabled:opacity-50"
        >
          {applies ? m.turnOff : m.turnOn}
        </button>
      )}
      {error && <p className="w-full text-xs text-danger-700">{error}</p>}
    </div>
  );
}
