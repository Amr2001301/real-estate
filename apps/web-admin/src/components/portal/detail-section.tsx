import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

/* ──────────────────────────────────────────────────────────────────────────────
 * DetailSection
 * Standard secondary section card for portal detail pages.
 *
 * Consistent header: icon + title + optional count badge + optional description.
 * Content area has p-6 padding by default; set noBodyPad to make children
 * go edge-to-edge (useful for tables/lists that bleed to card edges).
 * ──────────────────────────────────────────────────────────────────────────── */
export function DetailSection({
  icon,
  title,
  count,
  description,
  children,
  className,
  bodyClass,
  noBodyPad = false,
}: {
  icon?: ReactNode;
  title?: string;
  count?: number;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  noBodyPad?: boolean;
}) {
  const hasHeader = !!(title || icon !== undefined);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {hasHeader && (
        <div className="px-6 pt-6 pb-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {icon && (
              <span className="text-brand-600 [&_svg]:h-4 [&_svg]:w-4 shrink-0">{icon}</span>
            )}
            {title}
            {count !== undefined && (
              <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 ms-1">
                {count}
              </span>
            )}
          </h2>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>
      )}

      {/* Border separator only when content goes edge-to-edge */}
      {hasHeader && noBodyPad && <div className="mt-4 border-t border-hairline" />}

      <div
        className={cn(
          !noBodyPad && hasHeader && 'px-6 pt-4 pb-6',
          !noBodyPad && !hasHeader && 'p-6',
          bodyClass,
        )}
      >
        {children}
      </div>
    </Card>
  );
}
