'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Receipt,
  Wrench,
  Download,
  Loader2,
  AlertCircle,
  File,
} from 'lucide-react';
import type { MeDocument } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';

const OWNER_LABELS: Record<MeDocument['ownerType'], { label: string; icon: typeof FileText }> = {
  CONTRACT:            { label: 'عقود', icon: FileText },
  DEPOSIT:             { label: 'دفعات وإيصالات', icon: Receipt },
  MAINTENANCE_REQUEST: { label: 'طلبات صيانة', icon: Wrench },
};

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'CONTRACT', label: 'العقود' },
  { key: 'DEPOSIT', label: 'الدفعات' },
  { key: 'MAINTENANCE_REQUEST', label: 'الصيانة' },
];

function mimeIcon(mimeType: string | null): string {
  if (!mimeType) return '📄';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.startsWith('image/')) return '🖼';
  return '📄';
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '';
  }
}

function DocumentRow({ doc }: { doc: MeDocument }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const { icon: TypeIcon, label: typeLabel } = OWNER_LABELS[doc.ownerType];

  async function handleDownload() {
    setStatus('loading');
    try {
      const res = await fetch(`/api-proxy/me/documents/${doc.id}/download`);
      if (!res.ok) throw new Error('failed');
      const data: { url: string; fileName?: string | null } = await res.json();
      window.open(data.url, '_blank', 'noopener,noreferrer');
      setStatus('idle');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <div className="flex items-center gap-4 py-4 border-b border-hairline last:border-0">
      {/* File icon */}
      <span className="shrink-0 text-2xl leading-none" aria-hidden>
        {mimeIcon(doc.mimeType)}
      </span>

      {/* Meta */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-ink-strong truncate">
          {doc.title ?? doc.fileName ?? 'مستند'}
        </p>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <TypeIcon className="h-3 w-3 shrink-0 text-gold-500" aria-hidden />
            {typeLabel}
          </span>
          {doc.category && (
            <span className="text-[11px] text-ink-muted/70">· {doc.category}</span>
          )}
          <span className="text-[11px] text-ink-muted/60">· {formatDate(doc.createdAt)}</span>
        </div>
      </div>

      {/* Download button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === 'loading'}
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
          status === 'error'
            ? 'bg-error/10 text-error'
            : 'bg-surface-soft border border-hairline text-ink-strong hover:border-gold-300 hover:text-gold-700 hover:bg-gold-50',
        )}
      >
        {status === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : status === 'error' ? (
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden />
        )}
        {status === 'error' ? 'خطأ، أعد المحاولة' : 'تحميل'}
      </button>
    </div>
  );
}

export function DocumentList({
  documents,
  all,
  activeFilter,
}: {
  documents: MeDocument[];
  all: MeDocument[];
  activeFilter: string;
}) {
  const router = useRouter();

  const counts: Record<string, number> = { all: all.length };
  for (const d of all) {
    counts[d.ownerType] = (counts[d.ownerType] ?? 0) + 1;
  }

  function setFilter(key: string) {
    const url = key === 'all' ? routes.accountDocuments : `${routes.accountDocuments}?type=${key}`;
    router.push(url);
  }

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const count = counts[tab.key] ?? 0;
          const active = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-gold-400 bg-gold-100 text-gold-700'
                  : 'border-hairline bg-surface text-ink-strong hover:border-gold-200 hover:bg-gold-50/50',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    active ? 'bg-gold-200 text-gold-800' : 'bg-surface-soft text-ink-muted',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface p-8 text-center">
          <File className="mx-auto h-8 w-8 text-ink-muted/40 mb-3" aria-hidden />
          <p className="text-sm text-ink-muted">لا توجد مستندات في هذا التصنيف بعد.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-surface px-5 shadow-soft">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      <p className="text-xs text-ink-muted text-center">
        {documents.length} مستند · روابط التحميل صالحة لمدة 5 دقائق فقط لأسباب أمنية.
      </p>
    </div>
  );
}
