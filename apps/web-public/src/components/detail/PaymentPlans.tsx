import { Price } from '@/components/currency/CurrencyProvider';
import { formatNumber } from '@/lib/format';
import type { PublicPaymentPlan } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';
import { DEEP_BG } from '@/components/home/Hero';

export function planYears(months: number, locale: Locale): string {
  const x = extraT(locale).unitPage;
  if (months >= 12 && months % 12 === 0) {
    const y = months / 12;
    return `${formatNumber(y, locale)} ${y === 1 ? x.yearsOne : x.yearsMany}`;
  }
  return `${formatNumber(months, locale)} ${x.monthsMany}`;
}

/** A cash plan's saving on the listed price, when the plan carries it. */
export function cashSaving(p: PublicPaymentPlan, listPrice: number): number {
  const d = p.discountAmount ?? 0;
  if (d > 0) return d;
  return listPrice > p.netPrice ? listPrice - p.netPrice : 0;
}

/**
 * «طرق الدفع»: the unit's public plans side by side, one shape for both —
 * the label, the figure that matters (the monthly instalment, or the cash
 * price), one line under it, then the same rows. A line above says the
 * listed price is the instalment price and cash is discounted, so the two
 * figures never read as a contradiction.
 */
export function PaymentPlans({ plans, listPrice, locale }: { plans: PublicPaymentPlan[]; listPrice: number; locale: Locale }) {
  const x = extraT(locale).unitPage;
  const list = [...plans].sort((a, b) => Number(a.isCash) - Number(b.isCash)).slice(0, 4);
  const hasDiscountedCash = list.some((p) => p.isCash && cashSaving(p, listPrice) > 0);

  return (
    <div data-testid="unit-plans">
      <p className="-mt-3 mb-7 max-w-2xl text-[16px] leading-[1.9] text-ink-muted">{hasDiscountedCash ? x.plansIntroCash : x.plansIntro}</p>
      <div className={`grid gap-5 ${list.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {list.map((p) => {
          if (p.isCash) {
            const saved = cashSaving(p, listPrice);
            const pct = saved > 0 && listPrice > 0 ? Math.round((saved / listPrice) * 100) : 0;
            return (
              <article key={p.id} className="relative flex flex-col overflow-hidden rounded-[1.5rem] bg-surface p-7 ring-1 ring-hairline">
                <span className="absolute inset-x-0 top-0 h-1 bg-gold-400" aria-hidden />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{x.payCash}</span>
                  {pct > 0 && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">{x.offPct(formatNumber(pct, locale))}</span>}
                </div>
                <p className="mt-1 font-display text-lg font-semibold text-ink-strong">{p.name || x.planCash}</p>
                <p className="mt-6 font-display text-[2.3rem] font-semibold leading-none text-ink-strong"><Price value={p.netPrice} /></p>
                <p className="mt-2 text-sm text-ink-muted">{x.oneShot}</p>
                <span className="min-h-6 flex-1" aria-hidden />
                <dl className="divide-y divide-hairline border-t border-hairline pt-1 text-[15px]">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-muted">{x.listPrice}</dt>
                    <dd className={saved > 0 ? 'text-ink-muted line-through' : 'font-semibold text-ink-strong'}><Price value={listPrice} /></dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-muted">{x.discount}</dt>
                    <dd className="font-semibold text-emerald-700 dark:text-emerald-400">{saved > 0 ? <Price value={saved} /> : '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-muted">{x.cashPay}</dt>
                    <dd className="font-semibold text-ink-strong"><Price value={p.netPrice} /></dd>
                  </div>
                </dl>
              </article>
            );
          }
          const longest = p.options.reduce<PublicPaymentPlan['options'][number] | null>((a, o) => (!a || o.durationMonths > a.durationMonths ? o : a), null);
          return (
            <article key={p.id} className="relative flex flex-col overflow-hidden rounded-[1.5rem] p-7 text-white" style={{ background: DEEP_BG }}>
              <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
              <span className="relative text-[13px] font-semibold text-gold-300">{x.payInstalment}</span>
              <p className="relative mt-1 font-display text-lg font-semibold">{p.name}</p>
              <p className="relative mt-6 flex items-baseline gap-2 font-display text-[2.3rem] font-semibold leading-none">
                {longest ? <Price value={longest.installmentAmount} /> : <>{formatNumber(p.downPaymentPercent, locale)}%</>}
                {longest && <span className="text-base font-normal text-white/65">/ {x.perMonth}</span>}
              </p>
              <p className="relative mt-2 text-sm text-white/70">
                {longest ? x.downLine(formatNumber(p.downPaymentPercent, locale), planYears(longest.durationMonths, locale)) : x.downAmount}
              </p>
              <span className="min-h-6 flex-1" aria-hidden />
              <dl className="relative divide-y divide-white/15 border-t border-white/15 pt-1 text-[15px]">
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-white/65">{x.total}</dt>
                  <dd className="font-semibold"><Price value={longest?.totalPayable || p.netPrice} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-white/65">{x.downAmount} ({formatNumber(p.downPaymentPercent, locale)}%)</dt>
                  <dd className="font-semibold"><Price value={p.downPaymentAmount} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-white/65">{x.duration}</dt>
                  <dd className="font-semibold">{longest ? planYears(longest.durationMonths, locale) : '—'}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}
