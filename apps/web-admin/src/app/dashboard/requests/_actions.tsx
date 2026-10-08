'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { setInquiryStatusAction } from './actions';

interface Props {
  id: string;
  status: string;
  locale?: Locale;
}

/** FG-04 — the next step for one inquiry; a closed one has none. */
export function InquiryActions({ id, status, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.requests.actions;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === 'CLOSED') return null;

  function act(next: 'RESPONDED' | 'CLOSED') {
    setError(null);
    startTransition(async () => {
      const res = await setInquiryStatusAction(id, next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {status === 'OPEN' && (
          <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => act('RESPONDED')}>
            {m.markResponded}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => act('CLOSED')}>
          {m.close}
        </Button>
      </div>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </div>
  );
}
