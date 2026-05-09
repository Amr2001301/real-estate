'use client';

import { useFormStatus } from 'react-dom';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

const VARIANTS = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

export function SubmitButton({
  children,
  pendingLabel = 'جاري الحفظ…',
  variant = 'primary',
  className = '',
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
