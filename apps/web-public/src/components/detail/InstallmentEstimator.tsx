'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Price } from '@/components/currency/CurrencyProvider';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { extraT } from '@/messages/site-extra';
import { planYears } from './PaymentPlans';

type Frequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';

/** One unit type's figures, read from the published plan of its lowest-priced available unit. */
export interface TypeEstimate {
  label: string;
  unitId: string;
  unitCode: string;
  price: number;
  downAmount: number;
  downPercent: number;
  /** The plan's durations, shortest first, each with its own instalment (markup included). */
  options: { months: number; amount: number; frequency: Frequency }[];
}

/**
 * «احسب قسطك» beside a project: the visitor picks a unit type, then a
 * duration, and sees the down payment and the instalment the plan itself
 * sets for the lowest-priced available unit of that type. Nothing is
 * estimated here — a type whose units have no published plan is not offered.
 */
export function InstallmentEstimator({ estimates }: { estimates: TypeEstimate[] }) {
  const locale = useSiteLocale();
  const t = extraT(locale).projectSide;
  const [typeIdx, setTypeIdx] = useState(0);
  const est = estimates[typeIdx] ?? estimates[0]!;
  const [months, setMonths] = useState<number | null>(null);
  const option = est.options.find((o) => o.months === months) ?? est.options[est.options.length - 1]!;

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-surface p-7 shadow-[0_30px_70px_-34px_rgba(0,0,0,0.45)] ring-1 ring-hairline" data-testid="project-estimator">
      <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{t.calcEyebrow}</p>
      <h3 className="mt-1 font-display text-[1.25rem] font-semibold text-ink-strong">{estimates.length > 1 ? t.calcTitle : est.label}</h3>

      {estimates.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {estimates.map((e, i) => (
            <button
              key={e.unitId}
              type="button"
              onClick={() => {
                setTypeIdx(i);
                setMonths(null);
              }}
              aria-pressed={i === typeIdx}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                i === typeIdx ? 'bg-navy text-white dark:bg-gold-400 dark:text-[#1B1206]' : 'bg-surface-soft text-ink-muted hover:text-ink-strong',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-muted">{t.unitPrice}</p>
          <p className="truncate text-xs text-ink-muted">{t.fromUnit(est.unitCode)}</p>
        </div>
        <p className="shrink-0 text-[17px] font-semibold text-ink-strong">
          <Price value={est.price} />
        </p>
      </div>

      {est.options.length > 1 && (
        <div className="mt-4 grid gap-1 rounded-2xl bg-surface-soft p-1" style={{ gridTemplateColumns: `repeat(${est.options.length}, minmax(0, 1fr))` }}>
          {est.options.map((o) => (
            <button
              key={o.months}
              type="button"
              onClick={() => setMonths(o.months)}
              aria-pressed={o.months === option.months}
              className={cn(
                'rounded-xl py-2 text-[13px] font-semibold transition-colors',
                o.months === option.months ? 'bg-surface text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-strong',
              )}
            >
              {planYears(o.months, locale)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-surface-soft px-4 py-3">
          <p className="text-xs text-ink-muted">
            {t.down} ({formatNumber(est.downPercent, locale)}%)
          </p>
          <p className="mt-1 text-[16px] font-semibold text-ink-strong">
            <Price value={est.downAmount} />
          </p>
        </div>
        <div className="rounded-2xl bg-navy px-4 py-3 text-white dark:bg-gold-400 dark:text-[#1B1206]">
          <p className="text-xs opacity-75">{t.perFreq[option.frequency]}</p>
          <p className="mt-1 text-[16px] font-semibold">
            <Price value={option.amount} />
          </p>
        </div>
      </div>
      {est.options.length === 1 && <p className="mt-2 text-xs text-ink-muted">{t.over(planYears(option.months, locale))}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-muted">{t.calcNote}</p>
        <Link href={routes.unit(est.unitId) as Route} className="shrink-0 text-[13px] font-semibold text-navy hover:underline dark:text-gold-300">
          {t.viewUnit} ←
        </Link>
      </div>
    </div>
  );
}
