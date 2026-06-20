import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PremiumEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PremiumEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: PremiumEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 px-6 text-center',
        className,
      )}
    >
      {icon && (
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-100 text-brand-400 [&_svg]:h-6 [&_svg]:w-6 mb-1">
          {icon}
        </span>
      )}
      <h3 className="text-[15px] font-bold text-navy leading-snug">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
