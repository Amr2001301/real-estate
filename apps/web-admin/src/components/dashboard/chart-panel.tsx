import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

interface Props {
  title: string;
  description?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Inner canvas tint behind the chart. */
  canvas?: 'plain' | 'tinted';
}

export function ChartPanel({
  title,
  description,
  trailing,
  children,
  className,
  canvas = 'tinted',
}: Props) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      <div
        className={cn(
          'rounded-2xl',
          canvas === 'tinted' ? 'bg-info-50/60 p-4 sm:p-5' : 'p-0',
        )}
      >
        {children}
      </div>
    </Card>
  );
}
