import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';
import { Price } from '@/components/currency/CurrencyProvider';
import { formatCompact, formatNumber } from '@/lib/format';
import type { Locale } from '@/lib/locale';
import { extraT } from '@/messages/site-extra';

export interface UnitMixRow {
  label: string;
  count: number;
  href: string;
}

/**
 * «الأسعار والوحدات» under a project's booking card: the lowest price, the
 * span from the cheapest to the dearest available unit, and how many units of
 * each type are left — each line opens those units.
 */
export function ProjectPriceCard({
  min,
  max,
  mix,
  locale,
}: {
  min: number;
  max: number;
  mix: UnitMixRow[];
  locale: Locale;
}) {
  const t = extraT(locale).projectSide;
  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-surface p-7 shadow-[0_30px_70px_-34px_rgba(0,0,0,0.45)] ring-1 ring-hairline" data-testid="project-prices">
      <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{t.pricesEyebrow}</p>
      <h3 className="mt-1 font-display text-[1.35rem] font-semibold text-ink-strong">
        {t.startsFrom('')}
        <Price value={min} />
      </h3>

      {max > min && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-gradient-to-l from-gold-400 to-navy ltr:bg-gradient-to-r" aria-hidden />
          <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
            <span>{formatCompact(min, locale)}</span>
            <span>{formatCompact(max, locale)}</span>
          </div>
        </div>
      )}

      {mix.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {mix.map((row) => (
            <li key={row.href}>
              <Link
                href={row.href as Route}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-soft px-4 py-3 text-[14px] font-semibold text-ink-strong transition-colors hover:bg-hairline/60"
              >
                <span className="truncate">{row.label}</span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-ink-muted">
                  {t.units(formatNumber(row.count, locale))}
                  <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
