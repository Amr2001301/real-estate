'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { PublicPaymentPlan } from '@/lib/api-types';
import { Price } from '@/components/currency/CurrencyProvider';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { DEEP_BG } from '@/components/home/Hero';
import { extraT } from '@/messages/site-extra';
import { planYears } from './PaymentPlans';

/**
 * One instalment plan on a unit page. When the plan offers several durations
 * the visitor picks one, and the instalment, the total and the duration are
 * that option's own (the plan's markup per duration included). It opens on
 * the longest — the lowest instalment.
 */
export function InstalmentPlanCard({ plan }: { plan: PublicPaymentPlan }) {
  const locale = useSiteLocale();
  const x = extraT(locale).unitPage;
  const options = [...plan.options].sort((a, b) => a.durationMonths - b.durationMonths);
  const [months, setMonths] = useState<number | null>(null);
  const opt = options.find((o) => o.durationMonths === months) ?? options[options.length - 1] ?? null;
  const freq = opt?.frequency ?? 'MONTHLY';

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[1.5rem] p-7 text-white" style={{ background: DEEP_BG }} data-testid="instalment-plan">
      <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
      <span className="relative text-[13px] font-semibold text-gold-300">{x.payInstalment}</span>
      <p className="relative mt-1 font-display text-lg font-semibold">{plan.name}</p>

      {options.length > 1 && (
        <div
          className="relative mt-5 grid gap-1 rounded-2xl bg-white/10 p-1"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
          role="group"
          aria-label={x.duration}
        >
          {options.map((o) => (
            <button
              key={o.durationMonths}
              type="button"
              onClick={() => setMonths(o.durationMonths)}
              aria-pressed={o.durationMonths === opt?.durationMonths}
              className={cn(
                'rounded-xl py-2 text-[14px] font-semibold transition-colors',
                o.durationMonths === opt?.durationMonths ? 'bg-white text-[#141414]' : 'text-white/75 hover:text-white',
              )}
            >
              {planYears(o.durationMonths, locale)}
            </button>
          ))}
        </div>
      )}

      <p className="relative mt-6 flex items-baseline gap-2 font-display text-[2.3rem] font-semibold leading-none">
        {opt ? <Price value={opt.installmentAmount} /> : <>{formatNumber(plan.downPaymentPercent, locale)}%</>}
        {opt && <span className="text-base font-normal text-white/65">/ {x.perFreqShort[freq]}</span>}
      </p>
      {/* Balloon plan: the big payment beside the monthly one. */}
      {opt?.balloonAmount && opt.balloonEveryMonths ? (
        <p className="relative mt-2 flex items-baseline gap-2 font-display text-[1.35rem] font-semibold leading-none text-gold-300" data-testid="plan-balloon">
          + <Price value={opt.balloonAmount} />
          <span className="text-sm font-normal text-white/65">/ {x.balloonEvery(opt.balloonEveryMonths)}</span>
        </p>
      ) : null}
      <p className="relative mt-2 text-sm text-white/70">
        {opt ? x.downLine(formatNumber(plan.downPaymentPercent, locale), planYears(opt.durationMonths, locale)) : x.downAmount}
      </p>
      <span className="min-h-6 flex-1" aria-hidden />
      <dl className="relative divide-y divide-white/15 border-t border-white/15 pt-1 text-[15px]">
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-white/65">{x.total}</dt>
          <dd className="font-semibold"><Price value={opt?.totalPayable || plan.netPrice} /></dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-white/65">{x.downAmount} ({formatNumber(plan.downPaymentPercent, locale)}%)</dt>
          <dd className="font-semibold"><Price value={plan.downPaymentAmount} /></dd>
        </div>
        {opt?.balloonAmount && opt.balloonEveryMonths ? (
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-white/65">{x.balloonRow(opt.balloonEveryMonths)}</dt>
            <dd className="font-semibold"><Price value={opt.balloonAmount} /></dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-white/65">{x.duration}</dt>
          <dd className="font-semibold">{opt ? planYears(opt.durationMonths, locale) : '—'}</dd>
        </div>
      </dl>
    </article>
  );
}
