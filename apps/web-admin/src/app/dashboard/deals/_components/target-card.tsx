'use client';

import { useActionState, useState, useTransition } from 'react';
import { Gift, Pencil, Plus, Trash2, Trophy, Undo2 } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { formatExactCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dealsT, type BonusState, type TargetRow } from '@/components/deals/messages';
import { payBonusAction, removeTargetAction, setTargetAction, unpayBonusAction, type DealFormState } from '../actions';
import { ErrorLine, Pill, type Tone } from './ui';

const BONUS_TONE: Record<BonusState, Tone> = { NONE: 'slate', PENDING: 'slate', EARNED: 'gold', PAID: 'green' };

function Meter({ label, value, of, pct, done }: { label: string; value: string; of: string; pct: number; done: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-semibold text-slate-500">{label}</span>
        <span className="num font-bold text-slate-900">
          {value} <span className="font-normal text-slate-400">/ {of}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-500/15">
        <div className={cn('h-full rounded-full transition-all', done ? 'bg-success-500' : 'bg-gradient-to-l from-[#D8B66A] to-[#B38B3A]')} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/** One person's month: the target, how far they are, the bonus; the admin edits and pays. */
export function TargetCard({ row, period, locale, currency, canEdit }: { row: TargetRow; period: string; locale: Locale; currency: string; canEdit: boolean }) {
  const t = dealsT(locale).targets;
  const money = (v: number | string) => formatExactCurrency(v, currency, locale);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [rowError, setRowError] = useState<string>();
  const [state, action, saving] = useActionState<DealFormState, FormData>(async (prev, fd) => {
    const res = await setTargetAction(period, row.user.id, prev, fd);
    if (res.ok) setEditing(false);
    return res;
  }, {});
  const run = (fn: () => Promise<DealFormState>) =>
    start(async () => {
      const res = await fn();
      setRowError(res.error);
    });
  const tg = row.target;
  const achieved = row.progress?.achieved ?? false;

  return (
    <article
      className={cn(
        'flex flex-col rounded-[22px] border bg-surface p-5 sm:p-6',
        achieved ? 'border-[#D8B66A]/60 shadow-[0_18px_36px_-24px_rgb(184_140_58/0.7)]' : 'border-hairline',
      )}
      data-testid={`target-${row.user.id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-heading text-[16px] font-bold', achieved ? 'border-[#D8B66A] bg-[#0E1626] text-[#E6C77E]' : 'border-[#D8B66A]/45 bg-[#D8B66A]/10 text-brand-700')}>
            {achieved ? <Trophy className="h-5 w-5" /> : row.user.fullName.trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-slate-900">{row.user.fullName}</p>
            <p className="text-[12px] text-slate-500">{dealsT(locale).role[row.user.role === 'SALES_MANAGER' ? 'MANAGER' : 'AGENT']}</p>
          </div>
        </div>
        {tg && <Pill tone={BONUS_TONE[row.bonus]}>{achieved && row.bonus === 'NONE' ? t.achieved : t.bonus[row.bonus]}</Pill>}
      </header>

      {editing ? (
        <form action={action} className="mt-5 space-y-4 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.05] p-4" data-testid="target-form">
          <ErrorLine error={state.error} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-[12px] font-semibold text-slate-600">
              {t.commissionTarget}
              <Input name="commissionTarget" type="number" min={0} step="0.01" dir="ltr" required defaultValue={tg ? Number(tg.commissionTarget) : ''} className="mt-1.5" />
            </label>
            <label className="block text-[12px] font-semibold text-slate-600">
              {t.dealsTarget}
              <Input name="dealsTarget" type="number" min={0} max={1000} step="1" dir="ltr" required defaultValue={tg?.dealsTarget ?? ''} className="mt-1.5" />
            </label>
            <label className="block text-[12px] font-semibold text-slate-600">
              {t.bonusAmount}
              <Input name="bonusAmount" type="number" min={0} step="0.01" dir="ltr" defaultValue={tg ? Number(tg.bonusAmount) : ''} className="mt-1.5" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>{t.cancel}</Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid="target-save">{t.save}</Button>
          </div>
        </form>
      ) : tg ? (
        <div className="mt-5 space-y-4">
          <Meter label={t.commission} value={money(row.actual.commission)} of={money(tg.commissionTarget)} pct={row.progress!.commissionPct} done={row.actual.commission >= Number(tg.commissionTarget)} />
          {tg.dealsTarget > 0 && <Meter label={t.deals} value={String(row.actual.deals)} of={String(tg.dealsTarget)} pct={row.progress!.dealsPct} done={row.actual.deals >= tg.dealsTarget} />}
          {Number(tg.bonusAmount) > 0 && (
            <p className="flex items-center gap-2 text-[13px] text-slate-600">
              <Gift className="h-4 w-4 text-brand-700" aria-hidden />
              {t.bonusAmount}: <span className="num font-bold text-slate-900">{money(tg.bonusAmount)}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-[13.5px] text-slate-500">{t.noTarget}</p>
      )}

      <ErrorLine error={rowError} />
      {canEdit && !editing && (
        <footer className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-5">
          {tg && !tg.bonusPaidAt && (
            <button type="button" disabled={pending} onClick={() => run(() => removeTargetAction(tg.id))} className="me-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-slate-400 hover:bg-danger-50 hover:text-danger-700">
              <Trash2 className="h-3.5 w-3.5" /> {t.remove}
            </button>
          )}
          {row.bonus === 'PAID' && (
            <Button type="button" variant="ghost" size="sm" leftIcon={<Undo2 className="h-4 w-4" />} disabled={pending} onClick={() => run(() => unpayBonusAction(tg!.id))}>
              {t.unpay}
            </Button>
          )}
          {row.bonus !== 'PAID' && (
            <Button type="button" variant="outline" size="sm" leftIcon={tg ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} onClick={() => setEditing(true)} data-testid="target-edit">
              {tg ? t.edit : t.setTarget}
            </Button>
          )}
          {row.bonus === 'EARNED' && (
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => run(() => payBonusAction(tg!.id))} data-testid="target-pay">
              {t.payBonus}
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
