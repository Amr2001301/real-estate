import Link from 'next/link';
import { cn } from '@/lib/cn';

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
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  className,
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
        'flex items-center justify-between gap-3 px-4 py-3 border-t border-hairline bg-surface-muted/40 rounded-b-2xl',
        className,
      )}
    >
      <p className="text-xs text-slate-500">
        {from}–{to} <span className="text-slate-400">من</span> {total}
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={buildHref(prev)} disabled={page <= 1}>
          السابق
        </PageLink>
        <span className="text-xs text-slate-500 px-2">
          {page} / {totalPages}
        </span>
        <PageLink href={buildHref(next)} disabled={page >= totalPages}>
          التالي
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
    'inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
    disabled
      ? 'border-hairline text-slate-300 cursor-not-allowed'
      : 'border-hairline text-slate-700 hover:bg-surface hover:border-slate-300',
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
