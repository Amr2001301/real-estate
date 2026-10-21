'use client';

import { Children, useState, type ReactNode } from 'react';

/** A list showing its first `limit` items, with a row to show the rest. */
export function CollapsibleList({
  limit,
  showAllLabel,
  showLessLabel,
  className,
  children,
}: {
  limit: number;
  showAllLabel: string;
  showLessLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  const [all, setAll] = useState(false);
  const extra = items.length > limit;
  return (
    <ul className={className}>
      {all || !extra ? items : items.slice(0, limit)}
      {extra && (
        <li className="no-print px-4 py-2 text-center">
          <button
            type="button"
            data-testid="list-toggle"
            onClick={() => setAll((v) => !v)}
            className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-600"
          >
            {all ? showLessLabel : showAllLabel}
          </button>
        </li>
      )}
    </ul>
  );
}
