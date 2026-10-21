'use client';

import { useTransition } from 'react';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { verifyDepositAction } from './actions';

interface Props {
  id: string;
  contractId: string | null;
  verified: boolean;
  locale?: Locale;
}

export function VerifyToggle({ id, contractId, verified, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.deposits;
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => verifyDepositAction(id, contractId, !verified))}
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition disabled:opacity-60 ${
        verified
          ? 'bg-emerald-500/12 text-emerald-600 hover:bg-emerald-500/20'
          : 'bg-amber-500/12 text-amber-600 hover:bg-amber-500/20'
      }`}
    >
      {pending ? '…' : verified ? `✓ ${m.verifiedBadge}` : m.notVerifiedBadge}
    </button>
  );
}
