import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PremiumPageHeroProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  /** Small pill badge shown beside the action cluster (e.g. "مسودة", "نشط") */
  badge?: { label: string; dot?: boolean };
  /** Right-aligned action buttons */
  actions?: ReactNode;
  /** Extra row below the title (badges, timestamps, tags) */
  meta?: ReactNode;
  /** Optional slot rendered inside the card below the header content.
   *  Use to embed a PremiumMetricStrip flush with the hero card bottom. */
  children?: ReactNode;
  className?: string;
}

export function PremiumPageHero({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  meta,
  children,
  className,
}: PremiumPageHeroProps) {
  return (
    <div
      className={cn(
        'relative bg-surface border border-hairline rounded-[20px] shadow-soft',
        // No overflow-hidden here — it would clip popovers rendered in the actions slot.
        // The stripe clips itself via rounded-t-[19px] (card radius 20px − 1px border).
        className,
      )}
    >
      {/* Gold accent stripe — self-clipped to match card corner radius */}
      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[19px] bg-gradient-to-r from-brand-200 via-brand-500 to-brand-200 pointer-events-none" />

      <div className="px-7 sm:px-9 pt-8 pb-7">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <li key={i} className="flex items-center gap-1">
                    {!isLast && crumb.href ? (
                      <Link
                        href={crumb.href as never}
                        className="font-medium hover:text-brand-600 transition-colors duration-150"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'font-semibold text-slate-600' : 'font-medium'}>
                        {crumb.label}
                      </span>
                    )}
                    {!isLast && (
                      <span className="text-slate-300 text-sm select-none">›</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-navy leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
            {meta && (
              <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
            )}
          </div>

          {(actions || badge) && (
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:mt-1">
              {badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 tracking-wide select-none">
                  {badge.dot !== false && (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                  )}
                  {badge.label}
                </span>
              )}
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Optional embedded slot (e.g. metric strip flush to bottom of card) */}
      {children && <div>{children}</div>}
    </div>
  );
}
