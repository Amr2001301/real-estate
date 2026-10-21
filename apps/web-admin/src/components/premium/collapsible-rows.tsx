'use client';

import { Children, useState, type ReactNode } from 'react';

/**
 * A long table body shown as a window of rows (rows [from, to)), with a row
 * to show the rest — a 60-row schedule or statement no longer fills the page.
 */
export function CollapsibleRows({
  from,
  to,
  colSpan,
  showAllLabel,
  showLessLabel,
  children,
}: {
  from: number;
  to: number;
  colSpan: number;
  showAllLabel: string;
  showLessLabel: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  const [all, setAll] = useState(false);
  const start = Math.max(0, from);
  const end = Math.min(rows.length, to);
  if (start === 0 && end >= rows.length) return <>{rows}</>;
  const toggle = (label: string, where: string) => (
    <tr key={`toggle-${where}`} className="no-print">
      <td colSpan={colSpan} className="px-5 py-2.5 text-center">
        <button
          type="button"
          data-testid="rows-toggle"
          onClick={() => setAll((v) => !v)}
          className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-600"
        >
          {label}
        </button>
      </td>
    </tr>
  );
  if (all) return <>{[...rows, toggle(showLessLabel, 'end')]}</>;
  return (
    <>
      {start > 0 && toggle(showAllLabel, 'start')}
      {rows.slice(start, end)}
      {end < rows.length && toggle(showAllLabel, 'end')}
    </>
  );
}
