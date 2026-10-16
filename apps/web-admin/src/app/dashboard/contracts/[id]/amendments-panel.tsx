'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SearchSelect } from '@/components/form/search-select';
import type { ContractAmendment, Unit, User } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { swapContractUnitAction, transferContractAction } from '../actions';

const INPUT = 'h-9 w-full rounded-lg border border-hairline bg-white px-3 text-sm';
const BTN =
  'h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50';

// History of transfers (تنازل) and unit swaps (تبديل), plus — on a live
// contract — the two forms an admin uses to make them.
export function AmendmentsPanel({
  contractId,
  live,
  history,
  currency,
  locale = 'ar',
}: {
  contractId: string;
  live: boolean;
  history: ContractAmendment[];
  currency: string;
  locale?: Locale;
}) {
  const m = uiT(locale).contractDetailPage;
  const c = uiT(locale).common;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
        <p className="text-sm text-slate-500">{m.amendmentsEmpty}</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {history.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  {a.type === 'TRANSFER'
                    ? m.amendTransfer
                    : a.type === 'UNIT_SWAP'
                      ? m.amendSwap
                      : a.type === 'PRICE_CHANGE'
                        ? m.amendPrice
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
                {(a.type === 'UNIT_SWAP' || a.type === 'PRICE_CHANGE') && a.toTotal != null && (
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form onSubmit={submit(transferContractAction)} className="space-y-3 rounded-xl border border-hairline p-4">
            <p className="text-sm font-bold text-slate-900">{m.transferTitle}</p>
            <p className="text-[12px] text-slate-500">{m.transferHint}</p>
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

          <form onSubmit={submit(swapContractUnitAction)} className="space-y-3 rounded-xl border border-hairline p-4">
            <p className="text-sm font-bold text-slate-900">{m.swapTitle}</p>
            <p className="text-[12px] text-slate-500">{m.swapHint}</p>
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
            />
            <input
              name="totalAmount"
              type="number"
              required
              min={1}
              step="0.01"
              placeholder={m.swapTotal}
              aria-label={m.swapTotal}
              className={INPUT}
            />
            <input name="reason" required minLength={3} maxLength={2000} placeholder={m.amendReason} className={INPUT} />
            <button type="submit" disabled={pending} className={BTN} data-testid="swap-submit">
              {m.swapBtn}
            </button>
          </form>
        </div>
      )}
      {error && <p className="text-sm text-danger-700">{error}</p>}
    </div>
  );
}
