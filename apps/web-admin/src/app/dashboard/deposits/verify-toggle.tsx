'use client';

import { useTransition } from 'react';
import { verifyDepositAction } from './actions';

interface Props {
  id: string;
  contractId: string;
  verified: boolean;
}

export function VerifyToggle({ id, contractId, verified }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => verifyDepositAction(id, contractId, !verified))}
      className={`rounded-full px-2 py-0.5 text-xs font-medium transition disabled:opacity-60 ${
        verified
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
      }`}
    >
      {pending ? '…' : verified ? '✓ متحقق' : 'غير متحقق'}
    </button>
  );
}
