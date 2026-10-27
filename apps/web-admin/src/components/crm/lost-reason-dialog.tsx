'use client';

import { useEffect, useState } from 'react';
import type { LostReason } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { listLostReasonsAction } from '@/app/dashboard/leads/actions';
import { lostT } from './lost-messages';

/**
 * "Why did we lose this customer?" — asked whenever a lead is moved to LOST
 * (the stage bar on the lead page and the pipeline board).
 */
export function LostReasonDialog({
  open,
  locale = 'ar',
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  locale?: Locale;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (lost: { lostReasonId: string; lostNote?: string }) => void;
}) {
  const m = lostT(locale).dialog;
  const [reasons, setReasons] = useState<LostReason[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setNote('');
    if (reasons === null) listLostReasonsAction().then(setReasons, () => setReasons([]));
  }, [open, reasons]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={m.title}
      description={m.desc}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{m.cancel}</Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            data-testid="lost-confirm"
            disabled={!picked || pending}
            onClick={() => picked && onConfirm({ lostReasonId: picked, lostNote: note })}
          >
            {m.confirm}
          </Button>
        </div>
      }
    >
      <div data-testid="lost-dialog" className="space-y-4">
        {reasons === null ? (
          <p className="text-[13px] text-slate-500">{m.loading}</p>
        ) : reasons.length === 0 ? (
          <p className="text-[13px] text-slate-500">{m.empty}</p>
        ) : (
          <div role="radiogroup" aria-label={m.pick} className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={picked === r.id}
                onClick={() => setPicked(r.id)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40',
                  picked === r.id
                    ? 'border-danger-500 bg-danger-500/10 text-danger-700'
                    : 'border-hairline bg-surface text-slate-600 hover:border-danger-500/40 hover:text-slate-800',
                )}
              >
                {tx(r.name, locale)}
              </button>
            ))}
          </div>
        )}
        <label className="block text-[12.5px] font-semibold text-slate-500">
          {m.note}
          <Textarea
            data-testid="lost-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={m.notePlaceholder}
            className="mt-1 text-[13px]"
          />
        </label>
      </div>
    </Dialog>
  );
}
