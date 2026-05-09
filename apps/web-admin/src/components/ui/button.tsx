import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/60',
  secondary:
    'bg-slate-900 text-white shadow-xs hover:bg-slate-800 active:bg-slate-900 disabled:bg-slate-900/60',
  outline:
    'bg-surface text-slate-800 border border-hairline shadow-xs hover:bg-surface-muted hover:border-slate-300 disabled:opacity-60',
  ghost:
    'bg-transparent text-slate-700 hover:bg-surface-muted disabled:opacity-60',
  danger:
    'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-600/60',
  subtle:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-60',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    leftIcon,
    rightIcon,
    fullWidth,
    className,
    disabled,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-colors duration-150 ease-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : (
        leftIcon && <span className="-ms-0.5 inline-flex shrink-0">{leftIcon}</span>
      )}
      <span className="truncate">{children}</span>
      {!loading && rightIcon && (
        <span className="-me-0.5 inline-flex shrink-0">{rightIcon}</span>
      )}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 -ms-0.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
