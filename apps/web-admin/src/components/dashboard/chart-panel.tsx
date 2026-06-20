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
    <Card className={cn('overflow-hidden rounded-[20px]', className)}>
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-hairline bg-canvas/30">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-navy tracking-tight leading-snug">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
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
