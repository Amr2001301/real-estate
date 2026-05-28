'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';

/**
 * Direct-id signed-download row for documents that are already enumerated
 * in the page payload (e.g. each photo on the maintenance detail page).
 * The customer-facing detail endpoints now expose only safe metadata —
 * no `fileUrl` — so the customer needs this client-side click to mint
 * the short-lived signed URL just-in-time, same posture as
 * `DocumentDownloadByOwner` (see that component's docstring).
 */
interface SignedDownload {
  url: string;
  fileName?: string | null;
  contentType?: string | null;
  expiresIn?: number;
}

export function DocumentDownloadById({
  documentId,
  title,
}: {
  documentId: string;
  /** Visible label for the row (title || fileName || generic fallback). */
  title: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleClick() {
    setState('loading');
    try {
      const res = await fetch(`/api-proxy/me/documents/${encodeURIComponent(documentId)}/download`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        setState('error');
        return;
      }
      const signed = (await res.json()) as SignedDownload;
      window.open(signed.url, '_blank', 'noopener,noreferrer');
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-start transition-colors hover:border-gold-300 disabled:cursor-progress disabled:opacity-70"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <FileText className="h-5 w-5 shrink-0 text-gold-500" aria-hidden />
        <span className="line-clamp-1 text-sm font-medium text-ink-strong">{title}</span>
      </span>
      {state === 'loading' ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-muted" aria-hidden />
      ) : state === 'error' ? (
        <span className="shrink-0 text-xs font-medium text-red-600">تعذر الفتح</span>
      ) : (
        <Download className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      )}
    </button>
  );
}
