import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';

interface Props {
  title: string;
  description?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  canvas?: 'plain' | 'tinted';
}

export function ChartPanel({
  title,
  description,
  trailing,
  children,
  className,
  canvas = 'plain',
}: Props) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-hairline">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      <div className={cn(
        'p-5',
        canvas === 'tinted' && 'bg-surface-muted/20',
      )}>
        {children}
      </div>
    </Card>
  );
}
