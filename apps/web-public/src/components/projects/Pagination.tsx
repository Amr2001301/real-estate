import Link from 'next/link';
import type { Route } from 'next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

/** Server-rendered prev/next pagination (RTL: "previous" points right). */
export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const linkBase =
    'inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline bg-surface px-5 text-sm font-medium transition-colors';

  return (
    <nav className="mt-12 flex items-center justify-between gap-4" aria-label="تنقل بين الصفحات">
      {hasPrev ? (
        <Link href={buildHref(page - 1) as Route} className={cn(linkBase, 'text-ink-strong hover:border-hairline/30')}>
          <ChevronRight className="h-4 w-4" aria-hidden />
          السابق
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed text-ink-muted/50')} aria-disabled>
          <ChevronRight className="h-4 w-4" aria-hidden />
          السابق
        </span>
      )}

      <span className="text-sm text-ink-muted">
        صفحة {page} من {totalPages}
      </span>

      {hasNext ? (
        <Link href={buildHref(page + 1) as Route} className={cn(linkBase, 'text-ink-strong hover:border-hairline/30')}>
          التالي
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed text-ink-muted/50')} aria-disabled>
          التالي
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
