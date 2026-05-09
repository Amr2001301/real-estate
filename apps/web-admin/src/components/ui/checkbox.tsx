import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded-md border-hairline bg-surface shadow-xs',
        'text-brand-600 transition-colors',
        'focus:ring-2 focus:ring-brand-600/30 focus:ring-offset-1 focus:ring-offset-canvas focus:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );

  if (!label) return input;

  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
      {input}
      <span>{label}</span>
    </label>
  );
});
