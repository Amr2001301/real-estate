'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

export interface SegmentedItem {
  key: string;
  label: string;
  count?: number;
  /** A link (server-side filter) or a click (client-side filter). */
  href?: string;
  onClick?: () => void;
  /** Counts that need attention (overdue…) read in red. */
  alert?: boolean;
}

/**
 * The site's one filter switch: a soft rounded bar, the chosen option raised
 * in white, each option's count in a small badge. Used wherever a list is
 * filtered by a few fixed choices.
 */
export function SegmentedFilter({ items, active, className, label }: { items: SegmentedItem[]; active: string; className?: string; label?: string }) {
  return (
    <div className={cn('flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface-soft p-1 sm:inline-flex sm:w-auto', className)} role="tablist" aria-label={label}>
      {items.map((it) => {
        const on = it.key === active;
        const cls = cn(
          'inline-flex h-10 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors sm:flex-none',
          on ? 'bg-surface text-ink-strong shadow-[0_2px_10px_-4px_rgba(0,0,0,0.2)]' : 'text-ink-muted hover:text-ink-strong',
        );
        const body = (
          <>
            {it.label}
            {typeof it.count === 'number' && (
              <span
                className={cn(
                  'inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                  it.alert && it.count > 0
                    ? on ? 'bg-red-500 text-white' : 'bg-red-500/15 text-red-600'
                    : on ? 'bg-navy text-white' : 'bg-hairline/70 text-ink-muted',
                )}
              >
                {it.count}
              </span>
            )}
          </>
        );
        return it.href ? (
          <Link key={it.key} href={it.href as Route} role="tab" aria-selected={on} aria-current={on ? 'true' : undefined} className={cls}>
            {body}
          </Link>
        ) : (
          <button key={it.key} type="button" role="tab" aria-selected={on} aria-pressed={on} onClick={it.onClick} className={cls}>
            {body}
          </button>
        );
      })}
    </div>
  );
}
