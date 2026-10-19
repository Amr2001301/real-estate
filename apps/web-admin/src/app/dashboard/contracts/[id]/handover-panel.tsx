'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { formatDate } from '@/lib/format';
import { HANDOVER_CHECKLIST_KEYS, handoverT } from '@/messages/handover';
import { recordHandoverAction } from '../actions';

export interface UnitHandoverView {
  handedOverAt: string;
  checklist: Array<{ key: string; done: boolean }> | null;
  notes: string | null;
  performedById: string | null;
}

// The unit handover: the warranties start and the customer's maintenance
// requests open from its date. Recorded once, by an admin, after signing.
export function HandoverPanel({
  id,
  handover,
  signed,
  canRecord,
  unpaid = null,
  locale = 'ar',
}: {
  id: string;
  handover: UnitHandoverView | null;
  signed: boolean;
  canRecord: boolean;
  /** The contract's unpaid balance, formatted; null when nothing is left. */
  unpaid?: string | null;
  locale?: Locale;
}) {
  const m = handoverT(locale);
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (handover) {
    return (
      <div className="space-y-3 text-[13px]" data-testid="handover-recorded">
        <p>
          <span className="text-slate-500">{m.handedOverAt}: </span>
          <span className="font-semibold text-slate-900">{formatDate(handover.handedOverAt, locale)}</span>
        </p>
        {handover.performedById === null && <p className="text-xs text-slate-500">{m.backfilled}</p>}
        {(handover.checklist ?? []).length > 0 && (
          <ul className="space-y-1">
            {(handover.checklist ?? []).map((c) => (
              <li key={c.key} className={c.done ? 'text-success-700' : 'text-slate-400'}>
                {c.done ? '✓' : '○'} {m.items[c.key] ?? c.key}
              </li>
            ))}
          </ul>
        )}
        {handover.notes && <p className="whitespace-pre-line text-slate-700">{handover.notes}</p>}
      </div>
    );
  }

  if (!signed) return <p className="text-[13px] text-slate-500">{m.notSigned}</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // One click used to record it: the date and checklist above are easy
    // to miss, and the handover can't be undone.
    const checked = HANDOVER_CHECKLIST_KEYS.filter((k) => done[k]).length;
    const question = m.confirm(date, checked, HANDOVER_CHECKLIST_KEYS.length);
    if (!window.confirm(unpaid ? `${m.unpaid(unpaid)}\n${question}` : question)) return;
    setError(null);
    startTransition(async () => {
      const res = await recordHandoverAction(id, {
        handedOverAt: date,
        checklist: HANDOVER_CHECKLIST_KEYS.map((key) => ({ key, done: !!done[key] })),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-500">{m.notYet}</p>
      {canRecord && (
        <form onSubmit={submit} className="space-y-3" data-testid="handover-form">
          {unpaid && (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-700" data-testid="handover-unpaid">
              {m.unpaid(unpaid)}
            </p>
          )}
          <label className="block text-xs font-semibold text-slate-600">
            {m.handedOverAt}
            <input
              type="date"
              name="handedOverAt"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block h-9 w-48 rounded-lg border border-hairline bg-white px-2 text-sm"
            />
          </label>
          <fieldset>
            <legend className="text-xs font-semibold text-slate-600">{m.checklist}</legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {HANDOVER_CHECKLIST_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    name={`checklist-${key}`}
                    checked={!!done[key]}
                    onChange={(e) => setDone((d) => ({ ...d, [key]: e.target.checked }))}
                  />
                  {m.items[key]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs font-semibold text-slate-600">
            {m.notes}
            <textarea
              name="notes"
              maxLength={2000}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-hairline bg-white px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? m.recording : m.record}
          </button>
          {error && <p className="text-xs text-danger-700">{error}</p>}
        </form>
      )}
    </div>
  );
}
