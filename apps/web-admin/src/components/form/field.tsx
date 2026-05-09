import { ReactNode } from 'react';

interface Props {
  label: string;
  name?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, name, hint, error, required, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-danger-600 ms-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}

/**
 * Legacy class kept for any existing inline `<input className={inputClass}>` callers.
 * New code should use the `Input`/`Textarea`/`Select` primitives in `@/components/ui`.
 */
export const inputClass =
  'w-full rounded-xl border border-hairline bg-surface shadow-xs px-3 py-2 text-sm transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/15';
