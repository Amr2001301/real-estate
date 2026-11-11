import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateShort, formatNumber, formatPrice, pickAr } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';

export interface UnitValueItem {
  contractId: string;
  unitCode: string;
  projectName: unknown;
  area: number;
  purchasedAt: string;
  purchasePrice: string;
  purchasePricePerMeter: string;
  currentPricePerMeter: string;
  currentValue: string;
  gain: string;
  gainPct: number;
  history: Array<{ date: string; pricePerMeter: number }>;
}

/** The price per meter since the purchase, as a small line with a soft fill. */
function Sparkline({ points, up }: { points: Array<{ pricePerMeter: number }>; up: boolean }) {
  const w = 280;
  const h = 64;
  const vals = points.map((p) => p.pricePerMeter);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => [vals.length === 1 ? w : (i / (vals.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 12)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const tone = up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-16 w-full', tone)} preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="currentColor" opacity={0.1} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * «قيمة وحدتك»: each owned unit's value today at the company's current
 * prices against what was paid, with how the price per meter moved. The
 * API sends only what the company chose to show; none → nothing.
 */
export function UnitValueCard({ items, currency, locale = 'ar' }: { items: UnitValueItem[]; currency: string; locale?: Locale }) {
  if (items.length === 0) return null;
  const t = extraT(locale).unitValue;
  const money = (v: string | number) => formatPrice(v, currency, locale);

  return (
    <section data-testid="unit-value" className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface">
      <div className="flex items-start gap-3 border-b border-hairline bg-surface-soft/60 p-6 sm:px-7">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-strong">{t.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t.sub}</p>
        </div>
      </div>

      <ul className="divide-y divide-hairline">
        {items.map((it) => {
          const gain = Number(it.gain);
          const up = gain >= 0;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <li key={it.contractId} className="p-6 sm:px-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[15px] font-semibold text-ink-strong">
                  {pickAr(it.projectName as never, '', locale)} <span className="font-mono text-sm text-ink-muted" dir="ltr">· {it.unitCode}</span>
                </p>
                <p className="text-xs text-ink-muted">{t.since(formatDateShort(it.purchasedAt, locale))}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-xs text-ink-muted">{t.paid}</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink-strong">{money(it.purchasePrice)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{t.perMeter(money(it.purchasePricePerMeter))}</p>
                </div>
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-xs text-ink-muted">{t.now}</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink-strong">{money(it.currentValue)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{t.perMeter(money(it.currentPricePerMeter))}</p>
                </div>
                <div className={cn('rounded-2xl p-4', up ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
                  <p className={cn('text-xs', up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>{up ? t.gain : t.change}</p>
                  <p className={cn('mt-1 flex items-center gap-1.5 font-display text-lg font-semibold', up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                    <Icon className="h-4 w-4" aria-hidden />
                    <span dir="ltr">{up ? '+' : '−'}{money(Math.abs(gain))}</span>
                  </p>
                  <p className={cn('mt-0.5 text-xs font-semibold', up ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')} dir="ltr">
                    {up ? '+' : '−'}{formatNumber(Math.abs(it.gainPct), locale)}%
                  </p>
                </div>
              </div>

              {it.history.length > 1 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-ink-muted">{t.chart}</p>
                  <div dir="ltr">
                    <Sparkline points={it.history} up={up} />
                  </div>
                  {/* The line runs left to right: the purchase date under its start (left), today under its end. */}
                  <div className="mt-1 flex flex-row-reverse justify-between text-[11px] text-ink-muted [direction:ltr]">
                    <span dir="auto">{formatDateShort(it.history[it.history.length - 1]!.date, locale)}</span>
                    <span dir="auto">{formatDateShort(it.history[0]!.date, locale)}</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-hairline px-6 py-3 text-xs leading-relaxed text-ink-muted sm:px-7">{t.note}</p>
    </section>
  );
}
