'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { approveDepositAction, rejectDepositAction, type DepositFormState } from '../../deposits/actions';

interface ApproveProps {
  depositId: string;
  contractId: string | null;
}

export function ApproveDepositButton({ depositId, contractId }: ApproveProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const res = await approveDepositAction(depositId, contractId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={pending}
        loading={pending}
        onClick={handleClick}
        leftIcon={<Check className="h-3.5 w-3.5" />}
      >
        تأكيد الدفع
      </Button>
      {error && <span className="text-xs text-danger-700">{error}</span>}
    </div>
  );
}

interface RejectProps {
  depositId: string;
  contractId: string | null;
}

export function RejectDepositDialog({ depositId, contractId }: RejectProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<DepositFormState, FormData>(rejectDepositAction, {});
  const router = useRouter();

  // Close + refresh when the action returns ok.
  if (state.ok && open) {
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        leftIcon={<X className="h-3.5 w-3.5" />}
      >
        رفض الدفع
      </Button>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-end bg-slate-900/40 p-6 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">رفض إثبات الدفع</h3>
        <p className="mt-1 text-xs text-slate-500">
          سيتلقّى العميل إشعارًا بأن الإثبات قد رُفض، مع ملخّص من سبب الرفض (حتى 140 حرفًا).
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="depositId" value={depositId} />
          <input type="hidden" name="contractId" value={contractId ?? ''} />
          <label className="block text-sm font-medium text-slate-700">
            سبب الرفض
            <textarea
              name="reason"
              required
              rows={4}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="مثلاً: المبلغ لا يطابق قيمة القسط، أو الإيصال غير واضح…"
            />
          </label>
          {state.error && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 p-2.5 text-xs text-danger-700">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="sm">
              تأكيد الرفض
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
