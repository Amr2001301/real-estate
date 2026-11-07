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

/** Server-rendered prev/next pagination (RTL: "previous" points right). */
export function Pagination({ page, totalPages, buildHref, locale = 'ar' }: PaginationProps) {
  const t = extraT(locale).pagination;
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const linkBase =
    'inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline bg-surface px-5 text-sm font-medium transition-colors';

  return (
    <nav className="mt-12 flex items-center justify-between gap-4" aria-label={t.label}>
      {hasPrev ? (
        <Link href={buildHref(page - 1) as Route} className={cn(linkBase, 'text-ink-strong hover:border-hairline/30')}>
          <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
          {t.prev}
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed text-ink-muted/50')} aria-disabled>
          <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
          {t.prev}
        </span>
      )}

      <span className="text-sm text-ink-muted">
        {t.pageOf(page, totalPages)}
      </span>

      {hasNext ? (
        <Link href={buildHref(page + 1) as Route} className={cn(linkBase, 'text-ink-strong hover:border-hairline/30')}>
          {t.next}
          <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed text-ink-muted/50')} aria-disabled>
          {t.next}
          <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
        </span>
      )}
    </nav>
  );
}
