import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';

export interface PaginationProps {
  /** 1-based current page */
  page: number;
  pageSize: number;
  total: number;
  /** Path used to build URLs, e.g. "/dashboard/units" */
  basePath: string;
  /** Existing search params to preserve (excluding "page") */
  params?: Record<string, string | undefined>;
  className?: string;
  locale?: Locale;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  className,
  locale = 'ar',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const buildHref = (target: number): string => {
    const sp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    }
    sp.set('page', String(target));
    return `${basePath}?${sp.toString()}`;
  };

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="pagination"
      className={cn(
        'flex items-center justify-between gap-3 px-5 py-3 border-t border-hairline bg-surface-muted/30 rounded-b-2xl',
        className,
      )}
    >
      <p className="text-xs text-slate-500">
        {from}–{to} <span className="text-slate-400">{locale === 'en' ? 'of' : 'من'}</span>{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={buildHref(prev)} disabled={page <= 1}>
          {locale === 'en' ? 'Previous' : 'السابق'}
        </PageLink>
        <span className="text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-2.5 h-8 inline-flex items-center tabular-nums">
          {page} <span className="text-brand-400 mx-1">/</span> {totalPages}
        </span>
        <PageLink href={buildHref(next)} disabled={page >= totalPages}>
          {locale === 'en' ? 'Next' : 'التالي'}
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium border transition-colors duration-150',
    disabled
      ? 'border-hairline text-slate-300 cursor-not-allowed'
      : 'border-hairline text-slate-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700',
  );
  if (disabled)
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  return (
    <Link href={href as never} className={className}>
      {children}
    </Link>
  );
}
