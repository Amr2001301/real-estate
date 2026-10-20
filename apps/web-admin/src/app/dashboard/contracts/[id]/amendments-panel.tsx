'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SearchSelect } from '@/components/form/search-select';
import type { ContractAmendment, Unit, User } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { ActionTabs } from './action-tabs';
import { swapContractUnitAction, transferContractAction } from '../actions';

const INPUT =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const BTN =
  'h-10 rounded-xl bg-gradient-to-l from-brand-500 to-brand-600 px-6 text-sm font-bold text-[#1a1408] shadow-[0_8px_20px_-10px_rgba(201,162,77,0.8)] transition-opacity hover:opacity-90 disabled:opacity-50';

// History of transfers (تنازل) and unit swaps (تبديل), plus — on a live
// contract — the two forms an admin uses to make them.
export function AmendmentsPanel({
  contractId,
  live,
  history,
  currency,
  markupLeft = 0,
  locale = 'ar',
}: {
  contractId: string;
  live: boolean;
  history: ContractAmendment[];
  currency: string;
  /** The instalment markup still in the contract's total. */
  markupLeft?: number;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const c = uiT(locale).common;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // The new total is the new unit's price plus the markup still on the
  // contract: entered as the bare price, the contract lost its markup and
  // showed a net value under the unit's price.
  const [swapTotal, setSwapTotal] = useState('');
  const [pending, startTransition] = useTransition();

  function submit(action: typeof transferContractAction) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!window.confirm(m.amendConfirm)) return;
      const form = e.currentTarget;
      const data = new FormData(form);
      setError(null);
      startTransition(async () => {
        const res = await action(contractId, data);
        if (res.error) setError(res.error);
        else {
          form.reset();
          router.refresh();
        }
      });
    };
  }

  return (
    <div className="space-y-5" data-testid="contract-amendments">
      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-center text-[13px] text-slate-500">{m.amendmentsEmpty}</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
          {history.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-500/12 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700">
                  {a.type === 'TRANSFER'
                    ? m.amendTransfer
                    : a.type === 'UNIT_SWAP'
                      ? m.amendSwap
                      : a.type === 'PRICE_CHANGE'
                        ? m.amendPrice
                        : a.type === 'MARKUP_WAIVER'
                          ? m.planWaiveTitle
                          : m.amendReschedule}
                </span>
                {(a.type === 'TRANSFER' || a.type === 'UNIT_SWAP') && (
                  <span className="font-medium text-slate-900">
                    {a.type === 'TRANSFER'
                      ? `${a.fromCustomerName ?? '—'} ← ${a.toCustomerName ?? '—'}`
                      : `${a.fromUnitCode ?? '—'} ← ${a.toUnitCode ?? '—'}`}
                  </span>
                )}
                {a.type === 'TRANSFER' && a.feeAmount != null && Number(a.feeAmount) > 0 && (
                  <span className="tabular-nums text-slate-600">
                    {m.amendFee} {formatCurrency(a.feeAmount, currency, locale)}
                  </span>
                )}
                {(a.type === 'UNIT_SWAP' || a.type === 'PRICE_CHANGE' || a.type === 'MARKUP_WAIVER') && a.toTotal != null && (
                  <span className="tabular-nums text-slate-600">
                    {formatCurrency(a.fromTotal ?? 0, currency, locale)} ← {formatCurrency(a.toTotal, currency, locale)}
                  </span>
                )}
                <span className="text-[12px] text-slate-400">
                  {formatDate(a.createdAt, locale)}
                  {a.performedByName ? ` · ${m.amendBy} ${a.performedByName}` : ''}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-slate-600">{a.reason}</p>
            </li>
          ))}
        </ul>
      )}

      {live && (
        <ActionTabs labels={[m.transferTitle, m.swapTitle]}>
          <form onSubmit={submit(transferContractAction)} className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-slate-500">{m.transferHint}</p>
            <label className="block text-[12px] font-semibold text-slate-700">{m.transferTo}</label>
            <SearchSelect<User>
              name="toCustomerId"
              required
              endpoint="/api-proxy/users?role=CLIENT,CUSTOMER"
              toOption={(u) => ({
                id: u.id,
                label: `${u.fullName}${u.phone ? ` · ${u.phone}` : ''}`,
                raw: u,
              })}
              placeholder={c.searchClientPlaceholder}
              locale={locale}
            />
            <input
              name="feeAmount"
              type="number"
              min={0}
              step="0.01"
              placeholder={m.transferFeeLabel}
              aria-label={m.transferFeeLabel}
              className={INPUT}
            />
            <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
            <button type="submit" disabled={pending} className={BTN} data-testid="transfer-submit">
              {m.transferBtn}
            </button>
          </form>

          <form onSubmit={submit(swapContractUnitAction)} className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-slate-500">{m.swapHint}</p>
            <label className="block text-[12px] font-semibold text-slate-700">{m.swapUnit}</label>
            <SearchSelect<Unit>
              name="unitId"
              required
              endpoint="/api-proxy/units?status=AVAILABLE"
              toOption={(u) => ({
                id: u.id,
                label: `${u.code} · ${tx(u.building?.phase?.project?.name)} · ${formatCurrency(u.price, currency, locale)}`,
                raw: u,
              })}
              placeholder={c.searchUnitPlaceholder}
              locale={locale}
              onChange={(u) => setSwapTotal(u ? String(Math.round((Number(u.price) + markupLeft) * 100) / 100) : '')}
            />
            <input
              name="totalAmount"
              type="number"
              required
              min={1}
              step="0.01"
              value={swapTotal}
              onChange={(e) => setSwapTotal(e.target.value)}
              placeholder={m.swapTotal}
              aria-label={m.swapTotal}
              className={INPUT}
            />
            {markupLeft > 0 && (
              <p data-testid="swap-markup-hint" className="text-[12px] text-slate-500">
                {m.swapMarkupHint(formatCurrency(markupLeft, currency, locale))}
              </p>
            )}
            <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
            <button type="submit" disabled={pending} className={BTN} data-testid="swap-submit">
              {m.swapBtn}
            </button>
          </form>
        </ActionTabs>
      )}
      {error && <p className="rounded-xl bg-danger-500/10 px-4 py-2.5 text-sm text-danger-600">{error}</p>}
    </div>
  );
}
