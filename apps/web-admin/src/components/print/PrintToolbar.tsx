'use client';

import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';

/** Screen-only bar above a printed document; opens the print dialog on load. */
export function PrintToolbar({
  title,
  printLabel,
  closeLabel,
  hint,
}: {
  title: string;
  printLabel: string;
  closeLabel: string;
  hint: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 border-b border-slate-800 bg-slate-900/95 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-[11px] text-white/60">{hint}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          >
            <Printer className="h-4 w-4" />
            {printLabel}
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" />
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
