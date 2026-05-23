import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

const FIELD_BASE =
  'w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted/60 shadow-sm transition-colors duration-200 focus:border-gold-300 focus:ring-2 focus:ring-gold-400/40 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(FIELD_BASE, invalid && 'border-error focus:border-error focus:ring-error/30', className)}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...rest }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(FIELD_BASE, 'min-h-32 resize-y', invalid && 'border-error focus:border-error focus:ring-error/30', className)}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...rest }, ref) => (
  <select
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(FIELD_BASE, 'appearance-none bg-surface', invalid && 'border-error', className)}
    {...rest}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-navy">
        {label}
        {required && <span className="text-gold-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
