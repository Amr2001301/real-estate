import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'danger' | 'warning';

const HEADER_TONE: Record<Tone, string> = {
  default: 'bg-canvas/30 border-hairline',
  danger:  'bg-danger-50/40 border-danger-100',
  warning: 'bg-warning-50/40 border-warning-100',
};

const ICON_TONE: Record<Tone, string> = {
  default: 'bg-brand-50 ring-brand-100 text-brand-600',
  danger:  'bg-danger-50 ring-danger-100 text-danger-600',
  warning: 'bg-warning-50 ring-warning-100 text-warning-600',
};

const TITLE_TONE: Record<Tone, string> = {
  default: 'text-navy',
  danger:  'text-danger-700',
  warning: 'text-warning-700',
};

export interface PremiumSectionCardProps {
  title: string;
  description?: string;
  /** Icon rendered in a small rounded badge in the header */
  icon?: ReactNode;
  /** Trailing slot in the header (e.g. an action button or badge) */
  trailing?: ReactNode;
  tone?: Tone;
  /** Whether to apply default padding to the content area. Default: true */
  padded?: boolean;
  children: ReactNode;
  className?: string;
}

export function PremiumSectionCard({
  title,
  description,
  icon,
  trailing,
  tone = 'default',
  padded = true,
  children,
  className,
}: PremiumSectionCardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b',
          HEADER_TONE[tone],
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1 shrink-0 [&_svg]:h-[15px] [&_svg]:w-[15px]',
                ICON_TONE[tone],
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3
              className={cn(
                'text-[13.5px] font-bold leading-none',
                TITLE_TONE[tone],
              )}
            >
              {title}
            </h3>
            {description && (
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{description}</p>
            )}
          </div>
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>

      {/* Content */}
      <div className={cn(padded && 'p-5 sm:p-6')}>{children}</div>
    </div>
  );
}
