import type { ReactNode, FormHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Toolbar({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 mb-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface FilterBarProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
  trailing?: ReactNode;
}

export function FilterBar({ children, trailing, className, ...rest }: FilterBarProps) {
  return (
    <form
      className={cn(
        'bg-surface border border-hairline rounded-2xl shadow-xs p-4 mb-4',
        'flex flex-wrap items-end gap-3',
        className,
      )}
      {...rest}
    >
      <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">{children}</div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </form>
  );
}

export interface FilterFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FilterField({ label, htmlFor, children, className }: FilterFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-[160px]', className)}>
      <label
        htmlFor={htmlFor}
        className="text-2xs font-semibold uppercase tracking-widest text-slate-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
