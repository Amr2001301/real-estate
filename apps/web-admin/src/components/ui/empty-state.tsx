import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'text-center py-14 px-6 flex flex-col items-center gap-3',
        className,
      )}
    >
      {icon && (
        <div className="h-12 w-12 inline-flex items-center justify-center rounded-2xl bg-surface-muted text-slate-500 [&_svg]:h-6 [&_svg]:w-6 mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
