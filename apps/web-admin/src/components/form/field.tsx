import { ReactNode } from 'react';

interface Props {
  label: string;
  name?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, name, hint, error, children }: Props) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-1 text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';
