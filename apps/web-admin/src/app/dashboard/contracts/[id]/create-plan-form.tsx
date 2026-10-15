'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { createInstallmentPlanAction } from '../actions';

const inputClass =
  'rounded-xl border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-surface';

// Manual installment plan for a contract. The API checks the schedule adds up
// to the contract and says why when it does not; the message shows here.
export function CreatePlanForm({
  contractId,
  labels,
}: {
  contractId: string;
  labels: { months: string; monthly: string; submit: string };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await createInstallmentPlanAction(contractId, fd);
          if (res.error) setError(res.error);
        })
      }
      className="space-y-3"
      data-testid="create-plan-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input name="totalMonths" type="number" min={1} max={360} placeholder={labels.months} required className={inputClass} />
        <input name="monthlyAmount" type="number" step="any" min={0} placeholder={labels.monthly} className={inputClass} />
        <input name="startsAt" type="date" required className={inputClass} />
      </div>
      {error && <p className="text-xs text-danger-700">{error}</p>}
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {labels.submit}
      </Button>
    </form>
  );
}
