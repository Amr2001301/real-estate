'use client';

import { useActionState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { updateBrokerStatusAction, type BrokerFormState } from '../actions';

// A firm is created "قيد الانضمام", and its agents could sign in to a portal
// that refused every page, with nothing here saying the firm had to be
// activated first.
export function ActivateBrokerNotice({
  brokerId,
  locale = 'ar',
}: {
  brokerId: string;
  locale?: Locale;
}) {
  const m = uiT(locale).pages.brokerDetail;
  const [state, formAction, pending] = useActionState<BrokerFormState, FormData>(
    updateBrokerStatusAction.bind(null, brokerId),
    {},
  );
  return (
    <div
      data-testid="broker-pending-notice"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-100 bg-warning-50 px-5 py-4 text-sm text-warning-700"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1 min-w-[16rem]">{m.pendingNotice}</p>
      <form action={formAction}>
        <input type="hidden" name="status" value="ACTIVE" />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white disabled:opacity-50"
        >
          {m.activateBtn}
        </button>
      </form>
      {state.error && <p className="w-full text-xs text-danger-700">{state.error}</p>}
    </div>
  );
}
