'use client';

import { Children, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * One action at a time: a row of pills over the chosen form, so forms of
 * different heights never sit side by side with empty space under them.
 */
export function ActionTabs({ labels, children, testId }: { labels: string[]; children: ReactNode; testId?: string }) {
  const [active, setActive] = useState(0);
  const panes = Children.toArray(children);
  return (
    <div data-testid={testId}>
      <div role="tablist" className="flex gap-1.5 overflow-x-auto rounded-2xl border border-hairline bg-surface-muted/50 p-1.5">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors',
              i === active
                ? 'bg-surface text-brand-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.35)] ring-1 ring-brand-500/30'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-5">
        {panes[active]}
      </div>
    </div>
  );
}
