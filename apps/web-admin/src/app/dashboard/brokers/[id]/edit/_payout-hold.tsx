'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { Broker } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { setBrokerPayoutHoldAction } from '../../actions';

// Admin hold on a broker's payouts — earned commissions stay earned.
export default function BrokerPayoutHold({ broker, locale = 'ar' }: { broker: Broker; locale?: Locale }) {
  const m = uiT(locale).pages.brokerStatusForm;
  const held = !!broker.payoutHold;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="bg-surface border border-hairline rounded-[20px] px-7 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[14px] font-bold text-navy">{m.holdTitle}</p>
        <p className={held ? 'text-[12px] text-warning-700 mt-0.5' : 'text-[12px] text-slate-500 mt-0.5'}>
          {held ? m.holdOn : m.holdOff}
        </p>
        {error && <p className="text-xs text-danger-700 mt-1">{error}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        loading={pending}
        data-testid="broker-payout-hold"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await setBrokerPayoutHoldAction(broker.id, !held);
            if (res.error) setError(res.error);
          })
        }
      >
        {held ? m.holdBtnOff : m.holdBtnOn}
      </Button>
    </div>
  );
}
