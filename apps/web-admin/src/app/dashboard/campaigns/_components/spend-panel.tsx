'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import type { CampaignSpendEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { CampaignMessages } from '@/components/campaigns/messages';
import { addSpendAction, removeSpendAction, type CampaignFormState } from '../actions';

/** The campaign's spend by day; whoever runs campaigns adds a line from a dialog. */
export function SpendPanel({
  campaignId,
  entries,
  canManage,
  today,
  m,
  money,
  dates,
}: {
  campaignId: string;
  entries: CampaignSpendEntry[];
  canManage: boolean;
  today: string;
  m: CampaignMessages['detail'];
  /** Pre-formatted amounts and dates, keyed by entry id (and 'total'). */
  money: Record<string, string>;
  dates: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(addSpendAction.bind(null, campaignId), {});
  const [removing, startRemove] = useTransition();
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <div data-testid="spend-panel">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{m.spend.total}</p>
          <p className="num text-[30px] leading-none text-slate-900" data-testid="spend-total">{money.total}</p>
        </div>
        {canManage && (
          <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="spend-open">
            {m.spend.add}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline py-8 text-center">
          <Receipt className="h-6 w-6 text-slate-300" />
          <p className="text-[13px] text-slate-500">{m.spend.empty}</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-hairline">
          {entries.map((e) => (
            <li key={e.id} data-testid="spend-row" className="group flex items-center gap-3 py-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D8B66A]/12 text-brand-700">
                <Receipt className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{e.note || m.spend.title}</p>
                <p className="text-[11.5px] tabular-nums text-slate-400">{dates[e.id]}</p>
              </div>
              <span className="num text-[16px] tabular-nums text-slate-900">{money[e.id]}</span>
              {canManage && (
                <button
                  type="button"
                  aria-label={m.spend.remove}
                  disabled={removing}
                  onClick={() => {
                    if (!confirm(m.spend.confirmRemove)) return;
                    startRemove(async () => void (await removeSpendAction(campaignId, e.id)));
                  }}
                  className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-danger-500/10 hover:text-danger-600 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={m.spend.add} description={m.spend.desc} size="md">
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-semibold text-slate-500">
              {m.spend.amount}
              <Input name="amount" type="number" min={0.01} step="0.01" required dir="ltr" className="mt-1" data-testid="spend-amount" autoFocus />
            </label>
            <label className="text-[12px] font-semibold text-slate-500">
              {m.spend.date}
              <Input name="spentOn" type="date" required defaultValue={today} className="mt-1" data-testid="spend-date" />
            </label>
          </div>
          <label className="block text-[12px] font-semibold text-slate-500">
            {m.spend.note}
            <Input name="note" placeholder={m.spend.notePlaceholder} className="mt-1" />
          </label>
          {state.error && <p role="alert" className="text-[12.5px] text-danger-600">{m.error}: {state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{m.spend.cancel}</Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending} data-testid="spend-add">{m.spend.add}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
