import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(
  function Card({ className, interactive, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-surface border border-hairline rounded-2xl shadow-soft',
          interactive &&
            'transition-all duration-150 ease-smooth hover:shadow-card hover:-translate-y-px hover:border-brand-200 cursor-pointer',
          className,
        )}
        {...rest}
      />
    );
  },
);

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 pt-4 pb-3 border-b border-hairline flex items-start justify-between gap-4',
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-sm font-semibold text-slate-900 tracking-tight', className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-slate-500 mt-0.5', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3 border-t border-hairline flex items-center justify-between gap-3 bg-surface-muted/30 rounded-b-2xl',
        className,
      )}
      {...rest}
    />
  );
}
