import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { Locale } from '@/lib/locale';

/**
 * «خطوات الشراء» under a unit's booking card: what happens from a viewing to
 * the contract, with this unit's own terms (its plans' durations, down
 * payment and reservation) where its published plans give them.
 */
export function BuyingSteps({
  eyebrow,
  title,
  steps,
  locale,
  row = false,
}: {
  eyebrow: string;
  title: string;
  steps: { title: string; sub: ReactNode; href?: string }[];
  locale: Locale;
  /** The steps side by side (wide column) instead of one under another. */
  row?: boolean;
}) {
  return (
    <div className={cn('overflow-hidden rounded-[1.5rem] bg-surface ring-1 ring-hairline', row ? 'p-6' : 'p-7 shadow-[0_30px_70px_-34px_rgba(0,0,0,0.45)]')} data-testid="buying-steps">
      <p className="text-[13px] font-semibold text-gold-700 dark:text-gold-300">{eyebrow}</p>
      <h3 className="mt-1 font-display text-[1.25rem] font-semibold text-ink-strong">{title}</h3>
      <ol className={cn('mt-5', row && 'grid gap-5 sm:grid-cols-2 lg:grid-cols-4')}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={s.title} className={cn('relative flex gap-3.5', !last && !row && 'pb-5')}>
              {!last && !row && <span className="absolute bottom-0 start-[15px] top-8 w-0.5 bg-hairline" aria-hidden />}
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  i === 0 ? 'bg-navy text-white dark:bg-gold-400 dark:text-[#1B1206]' : 'bg-surface-soft text-ink-strong',
                )}
              >
                {formatNumber(i + 1, locale)}
              </span>
              <div className="min-w-0 pt-0.5">
                {s.href ? (
                  <Link href={s.href as Route} className="text-[15px] font-semibold text-ink-strong underline-offset-4 hover:underline">
                    {s.title}
                  </Link>
                ) : (
                  <p className="text-[15px] font-semibold text-ink-strong">{s.title}</p>
                )}
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{s.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
