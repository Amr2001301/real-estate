import { Price } from '@/components/currency/CurrencyProvider';
import { formatNumber } from '@/lib/format';
import type { PublicPaymentPlan } from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';
import { DEEP_BG } from '@/components/home/Hero';

function years(months: number, locale: Locale): string {
  const x = extraT(locale).unitPage;
  if (months >= 12 && months % 12 === 0) {
    const y = months / 12;
    return `${formatNumber(y, locale)} ${y === 1 ? x.yearsOne : x.yearsMany}`;
  }
  return `${formatNumber(months, locale)} ${x.monthsMany}`;
}

/**
 * The unit's public payment plans: each instalment plan on the company's
 * deep colour (down payment, monthly instalment, duration), a cash plan as
 * a light card with its saving.
 */
export function PaymentPlans({ plans, locale }: { plans: PublicPaymentPlan[]; locale: Locale }) {
  const x = extraT(locale).unitPage;
  const list = [...plans].sort((a, b) => Number(a.isCash) - Number(b.isCash)).slice(0, 4);
  return (
    <div className={`grid gap-5 ${list.length > 1 ? 'md:grid-cols-2' : ''}`} data-testid="unit-plans">
      {list.map((p) => {
        if (p.isCash) {
          const saved = p.discountAmount ?? 0;
          return (
            <div key={p.id} className="flex flex-col rounded-[1.5rem] border border-hairline bg-surface p-7">
              <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{x.cashLabel}</p>
              <p className="mt-1 font-display text-xl font-semibold text-ink-strong">{p.name || x.planCash}</p>
              <p className="mt-6 font-display text-[2.4rem] font-semibold leading-none text-ink-strong"><Price value={p.netPrice} /></p>
              <dl className="mt-6 divide-y divide-hairline border-t border-hairline text-[15px]">
                {saved > 0 && p.totalPrice ? (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-muted">{x.price}</dt>
                    <dd className="text-ink-muted line-through"><Price value={p.totalPrice} /></dd>
                  </div>
                ) : null}
                {saved > 0 && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-muted">{x.saveLabel}</dt>
                    <dd className="font-semibold text-emerald-700 dark:text-emerald-400"><Price value={saved} /></dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-ink-muted">{x.duration}</dt>
                  <dd className="font-semibold text-ink-strong">{x.cashLabel}</dd>
                </div>
              </dl>
            </div>
          );
        }
        const longest = p.options.reduce<PublicPaymentPlan['options'][number] | null>((a, o) => (!a || o.durationMonths > a.durationMonths ? o : a), null);
        return (
          <div key={p.id} className="relative flex flex-col overflow-hidden rounded-[1.5rem] p-7 text-white" style={{ background: DEEP_BG }}>
            <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 100% 0%, rgb(var(--c-gold-400) / 0.22), transparent 60%)' }} aria-hidden />
            <p className="relative text-[13px] font-semibold text-gold-300">{x.recommended}</p>
            <p className="relative mt-1 font-display text-xl font-semibold">{p.name}</p>
            <div className="relative mt-6 flex items-end gap-2">
              <span className="font-display text-[3rem] font-semibold leading-none">{formatNumber(p.downPaymentPercent, locale)}%</span>
              <span className="pb-1.5 text-[15px] text-white/70">{x.downAmount}</span>
            </div>
            <dl className="relative mt-6 divide-y divide-white/15 border-t border-white/15 text-[15px]">
              <div className="flex items-center justify-between gap-3 py-3">
                <dt className="text-white/65">{x.downAmount}</dt>
                <dd className="font-semibold"><Price value={p.downPaymentAmount} /></dd>
              </div>
              {longest && (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-white/65">{x.installmentFrom}</dt>
                  <dd className="font-semibold"><Price value={longest.installmentAmount} /></dd>
                </div>
              )}
              {longest && (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-white/65">{x.duration}</dt>
                  <dd className="font-semibold">{years(longest.durationMonths, locale)}</dd>
                </div>
              )}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export { years as planYears };
