'use client';

import { useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import { verifyDepositAction } from './actions';

/**
 * Counts a reversed payment again (it pays its installment once more).
 * Replaces the one-click "verified" toggle, which reversed or approved a
 * payment with no warning.
 */
export function ReapproveButton({ id, contractId, locale = 'ar' }: { id: string; contractId: string | null; locale?: Locale }) {
  const [pending, start] = useTransition();
  const en = locale === 'en';
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={pending}
      disabled={pending}
      leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
      onClick={() => {
        const ok = window.confirm(
          en
            ? 'Count this payment again? Its installment will be marked paid.'
            : 'إعادة احتساب هذه الدفعة؟ سيُعلَّم قسطها مدفوعًا من جديد.',
        );
        if (ok) start(() => verifyDepositAction(id, contractId, true));
      }}
    >
      {en ? 'Count this payment again' : 'إعادة احتساب الدفعة'}
    </Button>
  );
}
