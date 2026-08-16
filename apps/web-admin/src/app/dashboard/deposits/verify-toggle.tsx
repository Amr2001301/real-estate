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
      className={`rounded-full px-2 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
        verified
          ? 'bg-success-50 text-success-700 hover:bg-success-100'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      {pending ? '…' : verified ? `✓ ${m.verifiedBadge}` : m.notVerifiedBadge}
    </button>
  );
}
