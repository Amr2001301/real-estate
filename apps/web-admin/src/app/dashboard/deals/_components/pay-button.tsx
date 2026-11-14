'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { paySplitAction } from '../actions';

/** Pay out one share from the commissions list; a refusal shows under it. */
export function PaySplitButton({ dealId, splitId, label }: { dealId: string; splitId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await paySplitAction(dealId, splitId);
            setError(res.error);
          })
        }
        data-testid={`pay-${splitId}`}
      >
        {label}
      </Button>
      {error && <span role="alert" className="max-w-[16rem] text-[11.5px] font-medium text-danger-700">{error}</span>}
    </span>
  );
}
