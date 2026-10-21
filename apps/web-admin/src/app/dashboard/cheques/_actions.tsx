'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Landmark, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { inputClass } from '@/components/form/field';
import type { PaymentInstrumentStatus } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import {
  bounceChequeAction,
  cancelChequeAction,
  clearChequeAction,
  depositChequeAction,
  type ChequeActionState,
} from './actions';

interface Props {
  id: string;
  status: PaymentInstrumentStatus;
  /** Bounce is ADMIN-only on the API (payment-instruments:bounce, strict). */
  canBounce: boolean;
  locale?: Locale;
}

const today = () => new Date().toISOString().slice(0, 10);

const PILL_TONE = {
  brand:   'border-brand-500/40 bg-brand-500/10 text-brand-700 hover:bg-brand-500/20',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
  danger:  'border-danger-500/40 bg-danger-500/10 text-danger-600 hover:bg-danger-500/20',
  ghost:   'border-transparent text-slate-500 hover:text-danger-600',
} as const;

/** Compact row action: the table stays calm, the next step still stands out. */
function pill(tone: keyof typeof PILL_TONE): string {
  return `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${PILL_TONE[tone]}`;
}

/** The next step for one cheque: deposit or cancel it, then cleared or bounced. */
export function ChequeActions({ id, status, canBounce, locale = 'ar' }: Props) {
  const m = uiT(locale).chequesPage.actions;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'clear' | 'bounce' | null>(null);

  function act(fn: () => Promise<ChequeActionState>) {
    setError(null);
    startTransition(async () => {
      // The action's revalidatePath already sends the updated page back.
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }

  if (status !== 'PENDING_CLEARANCE' && status !== 'DEPOSITED') return null;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1.5">
        {status === 'PENDING_CLEARANCE' ? (
          <>
            <button
              type="button"
              className={pill('brand')}
              disabled={pending}
              onClick={() => act(() => depositChequeAction(id))}
            >
              <Landmark className="h-3.5 w-3.5" />
              {pending ? '…' : m.deposit}
            </button>
            <button
              type="button"
              className={pill('ghost')}
              disabled={pending}
              onClick={() => {
                if (confirm(m.cancelConfirm)) act(() => cancelChequeAction(id));
              }}
            >
              {m.cancel}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={pill('success')} onClick={() => setDialog('clear')}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {m.clear}
            </button>
            {canBounce && (
              <button type="button" className={pill('danger')} onClick={() => setDialog('bounce')}>
                <Undo2 className="h-3.5 w-3.5" />
                {m.bounce}
              </button>
            )}
          </>
        )}
      </div>
      {error && <span className="text-xs text-danger-700">{error}</span>}
      {dialog === 'clear' && <ClearDialog id={id} locale={locale} onClose={() => setDialog(null)} />}
      {dialog === 'bounce' && <BounceDialog id={id} locale={locale} onClose={() => setDialog(null)} />}
    </div>
  );
}

function useCloseOnOk(state: ChequeActionState, onClose: () => void) {
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
}

function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 p-2.5 text-xs text-danger-700">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {error}
    </p>
  );
}

const labelCls = 'flex flex-col gap-1.5 text-sm font-medium text-slate-700';

function ClearDialog({ id, locale, onClose }: { id: string; locale: Locale; onClose: () => void }) {
  const m = uiT(locale).chequesPage.actions;
  const [state, formAction] = useActionState<ChequeActionState, FormData>(clearChequeAction, {});
  useCloseOnOk(state, onClose);
  return (
    <Dialog open onClose={onClose} title={m.clearTitle} description={m.clearDesc} size="sm">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <label className={labelCls}>
          {m.clearDate}
          <input name="clearingDate" type="date" required defaultValue={today()} className={inputClass} />
        </label>
        <ErrorLine error={state.error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{m.closeBtn}</Button>
          <Button type="submit" variant="primary" size="sm">{m.confirmClear}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function BounceDialog({ id, locale, onClose }: { id: string; locale: Locale; onClose: () => void }) {
  const m = uiT(locale).chequesPage.actions;
  const [state, formAction] = useActionState<ChequeActionState, FormData>(bounceChequeAction, {});
  const [penalty, setPenalty] = useState('0');
  useCloseOnOk(state, onClose);
  return (
    <Dialog open onClose={onClose} title={m.bounceTitle} description={m.bounceDesc} size="md">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <label className={labelCls}>
          {m.bounceReason}
          <input
            name="bounceReason"
            required
            maxLength={500}
            placeholder={m.bounceReasonPlaceholder}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={labelCls}>
            {m.bounceDate}
            <input name="bounceDate" type="date" required defaultValue={today()} className={inputClass} />
          </label>
          <label className={labelCls}>
            {m.penaltyAmount}
            <input
              name="penaltyAmount"
              type="number"
              min={0}
              step="any"
              value={penalty}
              onChange={(e) => setPenalty(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        {Number(penalty) > 0 && (
          <label className={labelCls}>
            {m.penaltyDueDate}
            <input name="penaltyDueDate" type="date" required className={inputClass} />
          </label>
        )}
        <ErrorLine error={state.error} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{m.closeBtn}</Button>
          <Button type="submit" variant="danger" size="sm">{m.confirmBounce}</Button>
        </div>
      </form>
    </Dialog>
  );
}
