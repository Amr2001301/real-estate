import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PremiumFormPanelProps {
  /** Anchor id — used by the sidebar nav chips to scroll to this panel */
  id?: string;
  /** Short ordinal displayed in the number badge: '01', '02', etc. */
  number: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function PremiumFormPanel({
  id,
  number,
  title,
  description,
  children,
  className,
}: PremiumFormPanelProps) {
  return (
    <section
      id={id}
      className={cn(
        'bg-surface border border-hairline rounded-[20px] overflow-hidden',
        'shadow-[0_1px_4px_0_rgb(15_30_51_/_0.05),0_6px_28px_-6px_rgb(15_30_51_/_0.09)]',
        className,
      )}
    >
      {/* Panel header */}
      <div className="border-b border-hairline bg-surface-muted/20">
        <div className="px-7 sm:px-8 py-6 flex items-start gap-5">
          {/* Number badge */}
          <span className="mt-0.5 shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200 text-brand-700 text-[15px] font-bold leading-none shadow-xs">
            {number}
          </span>

          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-navy tracking-tight leading-snug">
              {title}
            </h2>
            {/* Gold decorative separator */}
            <div className="mt-1.5 h-px w-20 bg-gradient-to-r from-brand-300 to-transparent" />
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>
      </div>

      {/* Panel content */}
      <div className="px-7 sm:px-8 py-7">{children}</div>
    </section>
  );
}
