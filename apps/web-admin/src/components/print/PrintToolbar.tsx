'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Printer, X } from 'lucide-react';

/** The wordings a document can print with (screen only). */
export interface TemplateSwitcher {
  label: string;
  current: string;
  options: { id: string; name: string }[];
  /** The URL parameter it sets (default `template`). */
  param?: string;
}

/** Screen-only bar above a printed document; opens the print dialog on load. */
export function PrintToolbar({
  title,
  printLabel,
  closeLabel,
  hint,
  switcher,
}: {
  title: string;
  printLabel: string;
  closeLabel: string;
  hint: string;
  switcher?: TemplateSwitcher;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Opens the print dialog on load — not again after choosing another wording or form.
  const chosen = params.has('template') || params.has('form');
  useEffect(() => {
    if (chosen) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [chosen]);

  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 border-b border-slate-800 bg-slate-900/95 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-[11px] text-white/60">{hint}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {switcher && switcher.options.length > 1 && (
            <label className="flex items-center gap-2 text-[12px] text-white/70">
              {switcher.label}
              <select
                data-testid="print-template"
                value={switcher.current}
                onChange={(e) => {
                  const next = new URLSearchParams(params.toString());
                  next.set(switcher.param ?? 'template', e.target.value);
                  router.replace(`?${next.toString()}`);
                }}
                className="h-9 rounded-lg border border-white/20 bg-slate-800 px-2 text-[12.5px] text-white"
              >
                {switcher.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
