import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'h-8 text-xs px-2.5 rounded-lg',
  md: 'h-10 text-sm px-3 rounded-xl',
  lg: 'h-12 text-base px-4 rounded-xl',
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: Size;
  invalid?: boolean;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'md', invalid, leftAddon, rightAddon, className, ...rest },
  ref,
) {
  const base = cn(
    'block w-full bg-surface text-slate-900 placeholder:text-slate-400',
    'border border-hairline shadow-xs',
    'transition-colors duration-150',
    'hover:border-slate-300 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15',
    'disabled:bg-surface-muted disabled:text-slate-400 disabled:cursor-not-allowed',
    invalid && 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15',
    SIZE[inputSize],
  );

  if (!leftAddon && !rightAddon) {
    return <input ref={ref} className={cn(base, className)} {...rest} />;
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      {leftAddon && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">
          {leftAddon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(base, leftAddon && 'ps-9', rightAddon && 'pe-9')}
        {...rest}
      />
      {rightAddon && (
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">
          {rightAddon}
        </span>
      )}
    </div>
  );
});
