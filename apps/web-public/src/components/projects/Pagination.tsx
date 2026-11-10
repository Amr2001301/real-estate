import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  locale?: Locale;
}

/** The pages to show: first, last, and two either side of the current one, with gaps as null. */
export function pageWindow(page: number, totalPages: number): Array<number | null> {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  if (page <= 3) [2, 3, 4].forEach((p) => p <= totalPages && wanted.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => p >= 1 && wanted.add(p));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/** Server-rendered numbered pagination (RTL: "previous" points right). */
export function Pagination({ page, totalPages, buildHref, locale = 'ar' }: PaginationProps) {
  const t = extraT(locale).pagination;
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const cell =
    'inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface px-3.5 text-sm font-medium transition-colors';
  const off = 'cursor-not-allowed text-ink-muted/50';
  const on = 'text-ink-strong hover:border-navy/40';

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label={t.label}>
      {hasPrev ? (
        <Link href={buildHref(page - 1) as Route} className={cn(cell, on)}>
          <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
          {t.prev}
        </Link>
      ) : (
        <span className={cn(cell, off)} aria-disabled>
          <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
          {t.prev}
        </span>
      )}
      {pageWindow(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-ink-muted" aria-hidden>…</span>
        ) : p === page ? (
          <span key={p} className={cn(cell, 'border-navy bg-navy text-white')} aria-current="page">{p}</span>
        ) : (
          <Link key={p} href={buildHref(p) as Route} className={cn(cell, on)} aria-label={t.pageOf(p, totalPages)}>
            {p}
          </Link>
        ),
      )}
      {hasNext ? (
        <Link href={buildHref(page + 1) as Route} className={cn(cell, on)}>
          {t.next}
          <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
        </Link>
      ) : (
        <span className={cn(cell, off)} aria-disabled>
          {t.next}
          <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
        </span>
      )}
    </nav>
  );
}
