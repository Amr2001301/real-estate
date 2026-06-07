import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'block w-full bg-surface text-slate-900 placeholder:text-slate-400',
        'border border-hairline shadow-xs rounded-xl px-3 py-2 text-sm',
        'transition-colors duration-150 resize-y',
        'hover:border-slate-300 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15',
        'disabled:bg-surface-muted disabled:text-slate-400 disabled:cursor-not-allowed',
        invalid && 'border-danger-500 focus:border-danger-600 focus:ring-danger-500/15',
        className,
      )}
      {...rest}
    />
  );
});
