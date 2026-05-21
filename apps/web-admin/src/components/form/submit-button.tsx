'use client';

import { useFormStatus } from 'react-dom';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  /** Disable the button independently of the form's pending state. */
  disabled?: boolean;
}

export function SubmitButton({
  children,
  pendingLabel = 'جاري الحفظ…',
  variant = 'primary',
  className,
  disabled = false,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="md"
      loading={pending}
      disabled={pending || disabled}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
