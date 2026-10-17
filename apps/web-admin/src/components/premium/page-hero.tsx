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
  /** A small gold line above the title (e.g. today's date on the dashboard). */
  eyebrow?: ReactNode;
  /** Small status pill beside the actions (e.g. "مسودة", "نشط"). Not for repeating the title. */
  badge?: { label: string; dot?: boolean };
  /** Action buttons: outlined secondaries and at most one gold primary. */
  actions?: ReactNode;
  /** Extra row below the title (badges, timestamps, tags) */
  meta?: ReactNode;
  /** Rendered under the header — typically the page's PremiumMetricStrip. */
  children?: ReactNode;
  className?: string;
}

/**
 * The page header (U5): breadcrumb, a large Naskh title and a muted line on
 * the page ground — no card — with the actions on the same row.
 */
export function PremiumPageHero({
  title,
  description,
  breadcrumbs,
  eyebrow,
  badge,
  actions,
  meta,
  children,
  className,
}: PremiumPageHeroProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="breadcrumb" className="mb-3">
              <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-500">
                {breadcrumbs.map((crumb, i) => {
                  const isLast = i === breadcrumbs.length - 1;
                  return (
                    <li key={i} className="flex items-center gap-1.5">
                      {!isLast && crumb.href ? (
                        <Link
                          href={crumb.href as never}
                          className="hover:text-brand-700 transition-colors duration-150"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className={isLast ? 'font-bold text-brand-700' : undefined}>
                          {crumb.label}
                        </span>
                      )}
                      {!isLast && <span className="text-slate-400 select-none rtl:rotate-180">›</span>}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
          {eyebrow && <p className="mb-2 text-[13px] font-bold text-brand-700">{eyebrow}</p>}

          <h1 className="font-heading text-[32px] sm:text-[40px] font-bold leading-[1.3] text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-[15px] text-slate-500 leading-relaxed max-w-3xl">{description}</p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>

        {(actions || badge) && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {badge && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 select-none">
                {badge.dot !== false && <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />}
                {badge.label}
              </span>
            )}
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
