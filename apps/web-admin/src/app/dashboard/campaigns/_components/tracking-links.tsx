'use client';

import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';

/** The campaign's ad links, each with a copy button. */
export function TrackingLinks({
  links,
  labels,
}: {
  links: Array<{ label: string; url: string }>;
  labels: { copy: string; copied: string };
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1800);
    } catch {
      /* clipboard blocked: the link stays selectable */
    }
  };
  return (
    <ul className="space-y-3">
      {links.map((l) => (
        <li key={l.url} data-testid="tracking-link" className="rounded-2xl border border-hairline bg-surface-muted/40 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
            <Link2 className="h-3.5 w-3.5" /> {l.label}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 select-all truncate rounded-xl bg-surface px-3 py-2 text-[12px] text-slate-700 ring-1 ring-hairline">
              {l.url}
            </code>
            <button
              type="button"
              onClick={() => copy(l.url)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2 text-[12px] font-semibold text-slate-700 hover:border-brand-500/50 hover:text-brand-700"
            >
              {copied === l.url ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === l.url ? labels.copied : labels.copy}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
