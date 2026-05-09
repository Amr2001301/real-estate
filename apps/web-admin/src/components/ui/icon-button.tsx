import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'ghost' | 'outline' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  ghost: 'bg-transparent text-slate-600 hover:bg-surface-muted hover:text-slate-900',
  outline:
    'bg-surface text-slate-700 border border-hairline shadow-xs hover:bg-surface-muted hover:border-slate-300',
  subtle: 'bg-surface-muted text-slate-700 hover:bg-surface-sunken',
};

const SIZE: Record<Size, string> = {
  sm: 'h-7 w-7 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
  md: 'h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-10 w-10 rounded-xl [&_svg]:h-5 [&_svg]:w-5',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'md', label, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center transition-colors duration-150 ease-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
