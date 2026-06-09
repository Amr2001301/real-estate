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
        'flex flex-wrap items-center gap-2',
        'bg-surface border border-hairline rounded-2xl shadow-xs px-3 py-2.5',
        className,
      )}
      {...rest}
    >
      {children}
      {trailing && (
        <div className="flex items-center gap-2 ms-auto shrink-0">{trailing}</div>
      )}
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
    <div className={cn('shrink-0', className)}>
      {/* sr-only keeps the label in the accessibility tree without showing it visually */}
      <label htmlFor={htmlFor} className="sr-only">{label}</label>
      {children}
    </div>
  );
}
