import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'h-8 text-xs ps-2.5 pe-8 rounded-lg bg-[length:14px_14px] bg-[position:left_0.625rem_center]',
  md: 'h-10 text-sm ps-3 pe-9 rounded-xl bg-[length:16px_16px] bg-[position:left_0.75rem_center]',
  lg: 'h-12 text-base ps-4 pe-10 rounded-xl bg-[length:18px_18px] bg-[position:left_0.875rem_center]',
};

const CHEVRON_BG =
  "bg-no-repeat [background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/></svg>\")]";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  inputSize?: Size;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { inputSize = 'md', invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'block w-full appearance-none bg-surface text-slate-900',
        'border border-hairline shadow-xs',
        'transition-colors duration-150',
        'hover:border-slate-300 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15',
        'disabled:bg-surface-muted disabled:text-slate-400 disabled:cursor-not-allowed',
        invalid && 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15',
        CHEVRON_BG,
        SIZE[inputSize],
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});
