import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg bg-surface-muted animate-shimmer',
        'bg-gradient-to-r from-surface-muted via-surface-sunken to-surface-muted',
        'bg-[length:800px_100%]',
        className,
      )}
      {...rest}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}
