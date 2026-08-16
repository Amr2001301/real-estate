'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { removeCommissionFromPayoutAction } from '../actions';

export function RemoveCommissionButton({
  payoutId,
  commissionId,
  commissionNumber,
  locale = 'ar',
}: {
  payoutId: string;
  commissionId: string;
  commissionNumber: string;
  locale?: Locale;
}) {
  const m = uiT(locale).pages.brokerPayoutDetail;
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(m.removeCommissionConfirm(commissionNumber))) return;
        start(async () => {
          try {
            await removeCommissionFromPayoutAction(payoutId, commissionId);
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      {pending ? m.removingBtn : m.removeBtn}
    </Button>
  );
}
