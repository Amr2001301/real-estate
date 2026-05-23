'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { X, Scale, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { CoverImage } from '@/components/ui/CoverImage';
import { InlineNotice } from '@/components/states/InlineNotice';
import { useCompare, MAX_COMPARE } from './CompareContext';

/**
 * Sticky bottom compare bar. Appears once at least one unit is selected.
 * "قارن الآن" links to /compare?ids=... (the page itself is W7+).
 */
export function CompareBar() {
  const { items, remove, clear, notice } = useCompare();
  const active = items.length > 0;

  // Reserve space at the page bottom so the fixed bar never hides the footer
  // or pagination. Cleaned up when the bar hides.
  useEffect(() => {
    document.body.style.paddingBottom = active ? '8.5rem' : '';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [active]);

  if (!active) return null;

  const ids = items.map((i) => i.id).join(',');
  const compareHref = `${routes.compare}?ids=${ids}` as Route;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-container">
        {notice && (
          <div className="mb-3">
            <InlineNotice tone="warning">{notice}</InlineNotice>
          </div>
        )}
        <div className="flex flex-col gap-4 rounded-3xl border border-hairline bg-surface/95 p-4 shadow-lift backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
              <Scale className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex items-center gap-2">
              {items.map((item) => (
                <span key={item.id} className="group relative h-12 w-16 overflow-hidden rounded-xl border border-hairline">
                  <CoverImage src={item.coverImage} alt={item.label} className="h-full w-full" />
                  <button
                    type="button"
                    aria-label={`إزالة ${item.label}`}
                    onClick={() => remove(item.id)}
                    className="absolute inset-0 flex items-center justify-center bg-navy/0 text-white opacity-0 transition-all hover:bg-navy/60 hover:opacity-100"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              ))}
              <span className="ms-2 text-sm text-ink-muted">
                {items.length} من {MAX_COMPARE}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={compareHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-[15px] font-medium text-white transition-colors hover:bg-navy-700"
            >
              قارن الآن
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-navy"
            >
              <X className="h-4 w-4" aria-hidden />
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
