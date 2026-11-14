'use client';

import { useActionState, useState, useTransition } from 'react';
import { Ban, Coins, FileClock, Plus, Trash2, Undo2, Users, X } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { formatDate, formatExactCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dealsT, type Deal } from '@/components/deals/messages';
import {
  cancelDealAction,
  paySplitAction,
  recordClaimPaymentAction,
  recordCommissionAction,
  rejectClaimAction,
  removeClaimPaymentAction,
  submitClaimAction,
  unpaySplitAction,
  type DealFormState,
} from '../actions';
import { CLAIM_TONE, CollectedBar, ErrorLine, Panel, Pill } from './ui';

const label = 'block text-[12.5px] font-semibold text-slate-600';
const formBox = 'space-y-4 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.05] p-4';

type Money = (v: number | string) => string;

/** The commission on the navy band: earned, collected, still out. */
export function MoneyBand({ deal, locale, currency, canFinance }: { deal: Deal; locale: Locale; currency: string; canFinance: boolean }) {
  const t = dealsT(locale).detail;
  const money: Money = (v) => formatExactCurrency(v, currency, locale);
  const total = Number(deal.commissionTotal);
  const got = Number(deal.commissionReceived);
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState<DealFormState, FormData>(async (prev, fd) => {
    const res = await recordCommissionAction(deal.id, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  const direct = deal.kind !== 'PRIMARY' && deal.status === 'CLOSED' && canFinance;

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-navy-band p-6 text-[#F4ECD8] shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]" data-testid="deal-money">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-[#A9B0BD]">{t.money}</p>
          <p className="num mt-1 font-heading text-[30px] font-semibold leading-none">{money(total)}</p>
        </div>
        {direct && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="deal-record-received"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D8B66A]/50 px-3.5 py-1.5 text-[12.5px] font-bold text-[#E6C77E] transition-colors hover:bg-[#D8B66A]/10"
          >
            <Coins className="h-3.5 w-3.5" /> {t.recordReceived}
          </button>
        )}
      </div>
      <CollectedBar value={got} total={total} className="mt-5 bg-white/10" />
      <dl className="mt-4 grid grid-cols-2 gap-4 text-[12.5px]">
        <div>
          <dt className="text-[#A9B0BD]">{t.received}</dt>
          <dd className="num mt-1 text-[17px] font-bold">{money(got)}</dd>
        </div>
        <div className="text-end">
          <dt className="text-[#A9B0BD]">{t.outstanding}</dt>
          <dd className={cn('num mt-1 text-[17px] font-bold', total - got > 0 ? 'text-[#E8B96E]' : 'text-[#86C9A0]')}>{money(Math.max(0, total - got))}</dd>
        </div>
      </dl>
      {open && (
        <form action={action} className="mt-5 space-y-3 rounded-2xl border border-[#D8B66A]/30 bg-white/[0.04] p-4" data-testid="received-form">
          <ErrorLine error={state.error} />
          <label className="block text-[12.5px] font-semibold text-[#C9CED8]">
            {t.receivedTotal}
            <Input name="commissionReceived" type="number" required min={0} max={total} step="0.01" dir="ltr" defaultValue={got || total} className="mt-1.5" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="text-[#C9CED8] hover:bg-white/10" onClick={() => setOpen(false)}>{t.close}</Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid="received-save">{t.saveReceived}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** The developer's claim on a primary sale: submitted, paid in parts, or rejected. */
export function ClaimPanel({ deal, locale, currency, today, canFinance }: { deal: Deal; locale: Locale; currency: string; today: string; canFinance: boolean }) {
  const t = dealsT(locale).detail;
  const m = dealsT(locale);
  const claim = deal.claim!;
  const money: Money = (v) => formatExactCurrency(v, currency, locale);
  const paid = claim.payments.reduce((s, p) => s + Number(p.amount), 0);
  const left = Math.max(0, Math.round((Number(claim.amount) - paid) * 100) / 100);
  const [mode, setMode] = useState<null | 'submit' | 'reject' | 'pay'>(null);
  const [pending, start] = useTransition();
  const [rowError, setRowError] = useState<string>();
  const wrap = (fn: (prev: DealFormState, fd: FormData) => Promise<DealFormState>) =>
    async (prev: DealFormState, fd: FormData) => {
      const res = await fn(prev, fd);
      if (res.ok) setMode(null);
      return res;
    };
  const [submitState, submitAction, submitting] = useActionState<DealFormState, FormData>(wrap(submitClaimAction.bind(null, deal.id, claim.id)), {});
  const [rejectState, rejectAction, rejecting] = useActionState<DealFormState, FormData>(wrap(rejectClaimAction.bind(null, deal.id, claim.id)), {});
  const [payState, payAction, paying] = useActionState<DealFormState, FormData>(wrap(recordClaimPaymentAction.bind(null, deal.id, claim.id)), {});
  const live = deal.status === 'CLOSED' && canFinance;

  return (
    <Panel
      icon={<FileClock />}
      title={`${t.claim} · ${claim.code}`}
      sub={t.claimSub(claim.developerName)}
      testId="deal-claim"
      action={<Pill tone={CLAIM_TONE[claim.status]}>{m.claimStatus[claim.status]}</Pill>}
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [t.amount, money(claim.amount)],
          [t.received, money(paid)],
          [t.left, money(left)],
          [t.submittedOn, claim.submittedOn ? formatDate(claim.submittedOn, locale) : t.notSubmitted],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12px] font-semibold text-slate-500">{k}</dt>
            <dd className="num mt-1 text-[14.5px] font-bold text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      {claim.status === 'REJECTED' && claim.notes && (
        <p className="mt-4 rounded-xl bg-danger-500/10 px-3 py-2 text-[12.5px] text-danger-700">{claim.notes}</p>
      )}

      {live && claim.status !== 'PAID' && mode === null && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setMode('pay')} data-testid="claim-add-payment">
            {t.addPayment}
          </Button>
          {(claim.status === 'PENDING' || claim.status === 'REJECTED' || claim.status === 'SUBMITTED') && (
            <Button type="button" variant="outline" size="sm" onClick={() => setMode('submit')} data-testid="claim-submit">
              {claim.status === 'PENDING' ? t.submit : t.resubmit}
            </Button>
          )}
          {claim.payments.length === 0 && claim.status !== 'REJECTED' && (
            <Button type="button" variant="ghost" size="sm" className="text-danger-700" onClick={() => setMode('reject')}>
              {t.reject}
            </Button>
          )}
        </div>
      )}

      {mode === 'pay' && (
        <form action={payAction} className={cn(formBox, 'mt-5')} data-testid="claim-payment-form">
          <ErrorLine error={payState.error} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className={label}>
              {t.amount}
              <Input name="amount" type="number" required min={0.01} max={left} step="0.01" dir="ltr" defaultValue={left} className="mt-1.5" />
            </label>
            <label className={label}>
              {t.receivedOn}
              <Input name="receivedOn" type="date" required max={today} defaultValue={today} className="mt-1.5" />
            </label>
            <label className={label}>
              {t.note}
              <Input name="note" maxLength={500} className="mt-1.5" />
            </label>
          </div>
          <FormButtons onClose={() => setMode(null)} saving={paying} label={t.save} closeLabel={t.close} testId="claim-payment-save" />
        </form>
      )}
      {mode === 'submit' && (
        <form action={submitAction} className={cn(formBox, 'mt-5')}>
          <ErrorLine error={submitState.error} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              {t.submitDate}
              <Input name="submittedOn" type="date" required max={today} defaultValue={today} className="mt-1.5" />
            </label>
            <label className={label}>
              {t.note}
              <Input name="notes" maxLength={1000} className="mt-1.5" />
            </label>
          </div>
          <FormButtons onClose={() => setMode(null)} saving={submitting} label={t.save} closeLabel={t.close} testId="claim-submit-save" />
        </form>
      )}
      {mode === 'reject' && (
        <form action={rejectAction} className={cn(formBox, 'mt-5')}>
          <ErrorLine error={rejectState.error} />
          <label className={label}>
            {t.rejectReason}
            <Input name="notes" required minLength={3} maxLength={1000} className="mt-1.5" />
          </label>
          <FormButtons onClose={() => setMode(null)} saving={rejecting} label={t.reject} closeLabel={t.close} danger />
        </form>
      )}

      <div className="mt-6">
        <h3 className="text-[13px] font-bold text-slate-700">{t.payments}</h3>
        <ErrorLine error={rowError} />
        {claim.payments.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-500">{t.noPayments}</p>
        ) : (
          <ul className="mt-2 divide-y divide-hairline" data-testid="claim-payments">
            {claim.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="num text-[14px] font-bold text-slate-900">{money(p.amount)}</p>
                  <p className="text-[12px] text-slate-500">
                    {formatDate(p.receivedOn, locale)}
                    {p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                {live && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await removeClaimPaymentAction(deal.id, p.id);
                        setRowError(res.error);
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-slate-500 hover:bg-danger-50 hover:text-danger-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t.remove}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** The team's shares: who gets what, ready or paid; the admin pays them out. */
export function SplitsPanel({ deal, locale, currency, canFinance }: { deal: Deal; locale: Locale; currency: string; canFinance: boolean }) {
  const t = dealsT(locale).detail;
  const m = dealsT(locale);
  const money: Money = (v) => formatExactCurrency(v, currency, locale);
  const collected = Number(deal.commissionReceived) >= Number(deal.commissionTotal);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<DealFormState>) =>
    start(async () => {
      const res = await fn();
      setError(res.error);
    });

  return (
    <Panel icon={<Users />} title={t.splits} sub={t.splitsSub} testId="deal-splits">
      <ErrorLine error={error} />
      {deal.splits.length === 0 ? (
        <p className="text-[13.5px] text-slate-500">{deal.agentId ? t.noSplits : t.noAgentSplits}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {deal.splits.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" data-testid={`split-${s.role}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B66A]/45 bg-[#D8B66A]/10 font-heading text-[14px] font-bold text-brand-700">
                  {s.user.fullName.trim().charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-slate-900">{s.user.fullName}</p>
                  <p className="text-[12px] text-slate-500">
                    {m.role[s.role]} · <span className="num">{Number(s.sharePct)}%</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-end">
                  <p className="num text-[15px] font-bold text-slate-900">{money(s.amount)}</p>
                  {s.paidAt ? (
                    <Pill tone="green">{t.paidOn(formatDate(s.paidAt, locale))}</Pill>
                  ) : deal.status === 'CLOSED' ? (
                    <Pill tone={collected ? 'gold' : 'slate'}>{collected ? t.payable : t.awaiting}</Pill>
                  ) : null}
                </div>
                {canFinance && deal.status === 'CLOSED' && !s.paidAt && collected && (
                  <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => run(() => paySplitAction(deal.id, s.id))} data-testid={`split-pay-${s.role}`}>
                    {t.pay}
                  </Button>
                )}
                {canFinance && s.paidAt && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => unpaySplitAction(deal.id, s.id))}
                    title={t.unpay}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-500/10 hover:text-slate-700"
                  >
                    <Undo2 className="h-4 w-4" />
                    <span className="sr-only">{t.unpay}</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Cancel a deal recorded by mistake or that fell through. */
export function CancelDealButton({ dealId, locale }: { dealId: string; locale: Locale }) {
  const t = dealsT(locale).detail;
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState<DealFormState, FormData>(async (prev, fd) => {
    const res = await cancelDealAction(dealId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  return (
    <>
      <Button type="button" variant="outline" size="md" leftIcon={<Ban className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="deal-cancel">
        {t.cancelDeal}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A1120]/55 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={t.cancelDeal}>
          <form action={action} className="w-full max-w-md space-y-4 rounded-[22px] border border-hairline bg-surface p-6 shadow-2xl" data-testid="deal-cancel-form">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-heading text-[18px] font-bold text-slate-900">{t.cancelDeal}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-500/10" aria-label={t.close}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-600">{t.cancelHint}</p>
            <ErrorLine error={state.error} />
            <label className={label}>
              {t.cancelReason}
              <Input name="reason" required minLength={3} maxLength={500} className="mt-1.5" autoFocus />
            </label>
            <FormButtons onClose={() => setOpen(false)} saving={saving} label={t.confirmCancel} closeLabel={t.close} danger testId="deal-cancel-confirm" />
          </form>
        </div>
      )}
    </>
  );
}

function FormButtons({ onClose, saving, label: text, closeLabel, danger, testId }: {
  onClose: () => void;
  saving: boolean;
  label: string;
  closeLabel: string;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>{closeLabel}</Button>
      <Button type="submit" variant={danger ? 'danger' : 'primary'} size="sm" disabled={saving} data-testid={testId}>{text}</Button>
    </div>
  );
}
