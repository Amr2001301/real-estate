'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { paidBeforeSystemAction } from '../actions';

// A contract signed before the system: its schedule starts in the past and
// every row due before it was entered shows unpaid. The admin marks what the
// customer paid back then in one go (each row on its own due date).
export function PaidBeforeSystem({
  id,
  count,
  total,
  enteredOn,
  locale = 'ar',
}: {
  id: string;
  count: number;
  /** Formatted total of those rows. */
  total: string;
  /** The day the contract was entered, formatted. */
  enteredOn: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [upTo, setUpTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(m.paidBeforeConfirm(upTo))) return;
    setError(null);
    startTransition(async () => {
      const res = await paidBeforeSystemAction(id, upTo);
      if (res.error) setError(res.error);
      else {
        setDone(m.paidBeforeDone(res.count ?? 0));
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="paid-before-system">
      <p className="text-[13px] text-slate-600">{m.paidBeforeHint(count, total, enteredOn)}</p>
      <label className="block text-xs font-semibold text-slate-600">
        {m.paidBeforeUpTo}
        <input
          type="date"
          name="upTo"
          value={upTo}
          onChange={(e) => setUpTo(e.target.value)}
          className="mt-1 block h-9 w-48 rounded-lg border border-hairline bg-white px-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {m.paidBeforeBtn}
      </button>
      {error && <p className="text-xs text-danger-700">{error}</p>}
      {done && <p className="text-xs text-success-700">{done}</p>}
    </form>
  );
}
