'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

/** The campaign's ad links: the address in plain sight, its tracking tags as chips, one-click copy. */
export function TrackingLinks({
  links,
  labels,
}: {
  links: Array<{ label: string; url: string }>;
  labels: { copy: string; copied: string; params: string; open: string };
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
      {links.map((l) => {
        const u = new URL(l.url);
        const params = [...u.searchParams.entries()];
        const done = copied === l.url;
        return (
          <li key={l.url} data-testid="tracking-link" className="overflow-hidden rounded-2xl ring-1 ring-hairline">
            <div className="flex items-center justify-between gap-3 bg-surface-muted/50 px-4 py-2.5">
              <span className="text-[12px] font-semibold text-slate-600">{l.label}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-400 hover:text-brand-700">
                {labels.open} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-3 px-4 py-3.5">
              <p dir="ltr" className="break-all font-mono text-[12px] leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-900">{u.host}</span>
                {u.pathname}
                <span className="sr-only">{u.search}</span>
              </p>
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{labels.params}</p>
                <div dir="ltr" className="flex flex-wrap gap-1.5">
                  {params.map(([k, v]) => (
                    <span key={k} className="rounded-lg bg-[#D8B66A]/12 px-2 py-1 font-mono text-[11px] text-brand-800">
                      <span className="text-slate-500">{k}=</span>{v}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copy(l.url)}
                className={
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors ' +
                  (done ? 'bg-emerald-500/12 text-emerald-700' : 'bg-navy-band text-white hover:bg-navy-700')
                }
              >
                {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {done ? labels.copied : labels.copy}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
