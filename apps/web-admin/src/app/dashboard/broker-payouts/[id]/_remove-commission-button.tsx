'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { removeCommissionFromPayoutAction } from '../actions';

export function RemoveCommissionButton({
  payoutId,
  commissionId,
  commissionNumber,
}: {
  payoutId: string;
  commissionId: string;
  commissionNumber: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`إزالة العمولة ${commissionNumber} من هذه الدفعة؟`)) return;
        start(async () => {
          try {
            await removeCommissionFromPayoutAction(payoutId, commissionId);
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      {pending ? 'جاري…' : 'إزالة'}
    </Button>
  );
}
