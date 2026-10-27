'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CampaignSpendEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CampaignMessages } from '@/components/campaigns/messages';
import { addSpendAction, removeSpendAction, type CampaignFormState } from '../actions';

/** The campaign's spend by day: the list, and (for whoever runs campaigns) a line to add. */
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
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(addSpendAction.bind(null, campaignId), {});
  const [removing, startRemove] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <div data-testid="spend-panel" className="space-y-4">
      {canManage && (
        <form ref={form} action={formAction} className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-muted/50 p-4 sm:grid-cols-2 sm:items-end">
          <label className="text-[12px] font-semibold text-slate-500">
            {m.spend.amount}
            <Input name="amount" type="number" min={0.01} step="0.01" required dir="ltr" className="mt-1" data-testid="spend-amount" />
          </label>
          <label className="text-[12px] font-semibold text-slate-500">
            {m.spend.date}
            <Input name="spentOn" type="date" required defaultValue={today} className="mt-1" data-testid="spend-date" />
          </label>
          <label className="text-[12px] font-semibold text-slate-500 sm:col-span-2">
            {m.spend.note}
            <Input name="note" placeholder={m.spend.notePlaceholder} className="mt-1" />
          </label>
          <Button type="submit" variant="primary" size="md" disabled={pending} leftIcon={<Plus className="h-4 w-4" />} data-testid="spend-add" className="sm:col-span-2 sm:justify-self-end">
            {m.spend.add}
          </Button>
          {state.error && <p role="alert" className="text-[12.5px] text-danger-600 sm:col-span-2">{m.error}: {state.error}</p>}
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-[13px] text-slate-500">{m.spend.empty}</p>
      ) : (
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-hairline">
            {entries.map((e) => (
              <tr key={e.id} data-testid="spend-row">
                <td className="py-2.5 tabular-nums text-slate-500">{dates[e.id]}</td>
                <td className="py-2.5 font-semibold tabular-nums text-slate-900">{money[e.id]}</td>
                <td className="py-2.5 text-slate-600">{e.note}</td>
                {canManage && (
                  <td className="py-2.5 text-end">
                    <button
                      type="button"
                      aria-label={m.spend.remove}
                      disabled={removing}
                      onClick={() => {
                        if (!confirm(m.spend.confirmRemove)) return;
                        startRemove(async () => void (await removeSpendAction(campaignId, e.id)));
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-500/10 hover:text-danger-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hairline">
              <td className="pt-2.5 font-semibold text-slate-500">{m.spend.total}</td>
              <td className="pt-2.5 font-bold tabular-nums text-slate-900" data-testid="spend-total">{money.total}</td>
              <td colSpan={canManage ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
