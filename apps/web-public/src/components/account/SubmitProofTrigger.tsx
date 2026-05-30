'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SubmitPaymentProofForm } from './SubmitPaymentProofForm';

/**
 * Read submit-proof intent off the URL (?submit=proof&installmentId=…&amount=…
 * or ?resubmit=:depositId&amount=…). On close, strips the params via router
 * replace so the page returns to the plain deposits view.
 */
export function SubmitProofTrigger() {
  const router = useRouter();
  const sp = useSearchParams();
  const installmentId = sp.get('installmentId');
  const amount = sp.get('amount');
  const submitMode = sp.get('submit') === 'proof' && installmentId && amount;
  const resubmitDepositId = sp.get('resubmit');

  if (!submitMode && !resubmitDepositId) return null;

  function handleClose() {
    router.replace('/account/deposits');
  }

  return (
    <div className="space-y-2">
      <SubmitPaymentProofForm
        installmentId={installmentId ?? ''}
        amount={amount ?? '0'}
        resubmitDepositId={resubmitDepositId ?? undefined}
        onClose={handleClose}
      />
    </div>
  );
}
