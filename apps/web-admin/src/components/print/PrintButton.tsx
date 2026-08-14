'use client';

import { Printer } from 'lucide-react';

interface Props {
  /** The print sub-path, e.g. "reservations", "contracts", "deposits" */
  path: string;
  id: string;
  label?: string;
}

export function PrintButton({ path, id, label = 'طباعة PDF' }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.open(`/print/${path}/${id}`, '_blank')}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
    >
      <Printer className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {label}
    </button>
  );
}
