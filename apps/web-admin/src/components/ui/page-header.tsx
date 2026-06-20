import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
            {breadcrumbs.map((c, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {c.href && !last ? (
                    <Link
                      href={c.href as never}
                      className="hover:text-brand-600 transition-colors duration-150 font-medium"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn(last ? 'text-slate-700 font-semibold' : 'font-medium')}>
                      {c.label}
                    </span>
                  )}
                  {!last && (
                    <span aria-hidden className="text-slate-300 text-sm select-none">›</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-slate-500 max-w-2xl leading-relaxed">{description}</p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
    </header>
  );
}
