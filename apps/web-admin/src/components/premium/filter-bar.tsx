import type { ReactNode, FormHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface PremiumFilterBarProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Filter field children (inputs, selects) */
  children: ReactNode;
  /** Trailing cluster pushed to the end (buttons, export links, etc.) */
  trailing?: ReactNode;
}

export function PremiumFilterBar({
  children,
  trailing,
  className,
  ...rest
}: PremiumFilterBarProps) {
  return (
    <form
      className={cn(
        'flex flex-wrap items-center gap-2.5',
        'bg-surface border border-hairline rounded-[20px] shadow-soft',
        'px-4 sm:px-5 py-3.5',
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

/** Accessible label wrapper for a single filter input */
export interface PremiumFilterFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function PremiumFilterField({
  label,
  htmlFor,
  children,
  className,
}: PremiumFilterFieldProps) {
  return (
    <div className={cn('shrink-0', className)}>
      <label htmlFor={htmlFor} className="sr-only">
        {label}
      </label>
      {children}
    </div>
  );
}
