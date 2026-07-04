import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

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
    <Card className={cn('overflow-hidden p-0', className)}>
      {hasHeader && (
        <div className="flex items-center gap-3 px-6 py-4 bg-canvas/30 border-b border-hairline">
          {icon && (
            <span className="h-8 w-8 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 flex items-center justify-center shrink-0 [&_svg]:h-4 [&_svg]:w-4">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              {count !== undefined && (
                <span className="text-2xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                  {count}
                </span>
              )}
            </div>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
        </div>
      )}

      <div
        className={cn(
          !noBodyPad ? 'p-6' : '',
          bodyClass,
        )}
      >
        {children}
      </div>
    </Card>
  );
}
