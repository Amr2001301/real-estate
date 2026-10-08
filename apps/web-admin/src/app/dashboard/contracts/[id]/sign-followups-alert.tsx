'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { retrySignFollowupsAction } from '../actions';

// FG-10 — signing also starts the unit's warranties and creates the broker and
// sales commissions. When one of those failed, the contract is signed but they
// are missing; the admin re-runs them here (each step is idempotent).
export function SignFollowupsAlert({ id, locale = 'ar' }: { id: string; locale?: Locale }) {
  const m = uiT(locale).contractDetailPage;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function retry() {
    setError(null);
    startTransition(async () => {
      const res = await retrySignFollowupsAction(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div
      role="alert"
      data-testid="sign-followups-alert"
      className="flex flex-wrap items-start gap-3 rounded-xl border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{m.signFollowupsFailed}</p>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="h-8 rounded-lg bg-warning-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
      >
        {m.signFollowupsRetry}
      </button>
      {error && <p className="w-full text-xs text-danger-700">{error}</p>}
    </div>
  );
}
