'use client';

import { Children, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ContractTab {
  key: string;
  label: string;
  /** Small count beside the label (late rows, payments…). */
  badge?: number;
  /** Tints the badge red (something is late). */
  alert?: boolean;
}

/**
 * The contract page in tabs: every pane is rendered on the server and the
 * inactive ones are hidden, so switching is instant; the chosen tab goes into
 * the URL (?tab=) so a link opens on it.
 */
export function ContractTabs({
  tabs,
  initial,
  children,
}: {
  tabs: ContractTab[];
  initial: string;
  children: ReactNode;
}) {
  const panes = Children.toArray(children);
  const [active, setActive] = useState(tabs.some((t) => t.key === initial) ? initial : tabs[0]!.key);

  // Back/forward between tabs.
  useEffect(() => {
    const onPop = () => {
      const t = new URLSearchParams(window.location.search).get('tab');
      setActive(tabs.some((x) => x.key === t) ? t! : tabs[0]!.key);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tabs]);

  const choose = (key: string) => {
    if (key === active) return;
    setActive(key);
    const url = new URL(window.location.href);
    if (key === tabs[0]!.key) url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.pushState(null, '', url);
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        data-testid="contract-tabs"
        className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-hairline bg-canvas/90 px-1 backdrop-blur"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={t.key === active}
            aria-controls={`pane-${t.key}`}
            data-tab={t.key}
            onClick={() => choose(t.key)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-[13.5px] font-semibold transition-colors',
              t.key === active
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-900',
            )}
          >
            {t.label}
            {!!t.badge && (
              <span
                className={cn(
                  'rounded-full px-2 py-px text-[11px] font-bold tabular-nums',
                  t.alert ? 'bg-danger-500/12 text-danger-600' : 'bg-surface-muted text-slate-500',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`pane-${t.key}`}
          aria-labelledby={`tab-${t.key}`}
          data-testid={`contract-pane-${t.key}`}
          hidden={t.key !== active}
          className="space-y-6"
        >
          {panes[i]}
        </div>
      ))}
    </div>
  );
}
