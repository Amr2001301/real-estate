'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  deleteDepositAction,
  restoreDepositAction,
  reverseDepositAction,
  type DepositFormState,
} from '../actions';

interface Props {
  id: string;
  contractId: string | null;
  reversible: boolean;
  deleted: boolean;
  locale?: Locale;
}

// FG-05 — the API reverses a paying deposit and reverses-then-deletes on
// delete; this gives the admin the buttons for it.
export function DepositManage({ id, contractId, reversible, deleted, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.depositsDetail.manage;
  const router = useRouter();
  const [dialog, setDialog] = useState<'reverse' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<DepositFormState>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else {
        setDialog(null);
        router.refresh();
      }
    });
  }

  if (deleted) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger-100 bg-danger-50 p-3" data-testid="deposit-deleted">
        <p className="flex-1 text-sm text-danger-700">{m.deletedBanner}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          disabled={pending}
          onClick={() => run(() => restoreDepositAction(id, contractId))}
          leftIcon={<Undo2 className="h-3.5 w-3.5" />}
        >
          {m.restore}
        </Button>
        <ErrorLine error={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reversible && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialog('reverse')}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        >
          {m.reverse}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDialog('delete')}
        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
        className="text-danger-700"
      >
        {m.delete}
      </Button>

      {dialog === 'reverse' && (
        <ReverseDialog id={id} contractId={contractId} locale={locale} onClose={() => setDialog(null)} onDone={() => router.refresh()} />
      )}
      {dialog === 'delete' && (
        <Dialog open onClose={() => setDialog(null)} title={m.deleteTitle} description={m.deleteDesc} size="sm">
          <div className="space-y-3">
            <ErrorLine error={error} />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDialog(null)}>{m.closeBtn}</Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={pending}
                disabled={pending}
                onClick={() => run(() => deleteDepositAction(id, contractId))}
              >
                {m.confirmDelete}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ReverseDialog({
  id,
  contractId,
  locale,
  onClose,
  onDone,
}: {
  id: string;
  contractId: string | null;
  locale: Locale;
  onClose: () => void;
  onDone: () => void;
}) {
  const m = uiT(locale).pages.depositsDetail.manage;
  const [state, formAction, pending] = useActionState<DepositFormState, FormData>(reverseDepositAction, {});
  useEffect(() => {
    if (state.ok) {
      onClose();
      onDone();
    }
  }, [state, onClose, onDone]);
  return (
    <Dialog open onClose={onClose} title={m.reverseTitle} description={m.reverseDesc} size="md">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="depositId" value={id} />
        <input type="hidden" name="contractId" value={contractId ?? ''} />
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          {m.reverseReason}
          <textarea
            name="reason"
            required
            rows={3}
            maxLength={2000}
            placeholder={m.reverseReasonPlaceholder}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </label>
        <ErrorLine error={state.error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{m.closeBtn}</Button>
          <Button type="submit" variant="primary" size="sm" loading={pending} disabled={pending}>{m.confirmReverse}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ErrorLine({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p className="flex w-full items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 p-2.5 text-xs text-danger-700">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {error}
    </p>
  );
}
