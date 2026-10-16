'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { waiveLateFeeAction } from '../actions';

// An unpaid late fee can be waived by an admin; it stays on the schedule as waived.
export function WaiveLateFeeButton({
  contractId,
  installmentId,
  locale = 'ar',
}: {
  contractId: string;
  installmentId: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function waive() {
    if (!window.confirm(m.waiveLateFeeConfirm)) return;
    setError(null);
    startTransition(async () => {
      const res = await waiveLateFeeAction(contractId, installmentId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={waive}
        disabled={pending}
        data-testid="waive-late-fee"
        className="h-7 rounded-lg border border-hairline bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-canvas disabled:opacity-50"
      >
        {m.waiveLateFeeBtn}
      </button>
      {error && <span className="text-[11px] text-danger-700">{error}</span>}
    </span>
  );
}
