'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { assignContractNumberAction } from '../actions';

// FG-04 — contracts created before numbering have none. An admin gives them
// one here (empty → the next CON-<year>-<seq>); once set it does not change.
export function AssignContractNumber({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await assignContractNumberAction(id, value.trim());
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" data-testid="assign-contract-number">
      <input
        name="contractNumber"
        dir="ltr"
        maxLength={50}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={m.assignNumberPlaceholder}
        aria-label={m.fieldContractNumber}
        className="h-8 w-40 rounded-lg border border-hairline bg-white px-2 font-mono text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {m.assignNumber}
      </button>
      {error && <p className="w-full text-xs text-danger-700">{error}</p>}
    </form>
  );
}
