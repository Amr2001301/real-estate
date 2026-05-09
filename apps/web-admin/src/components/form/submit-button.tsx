'use client';

import { useFormStatus } from 'react-dom';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export function SubmitButton({
  children,
  pendingLabel = 'جاري الحفظ…',
  variant = 'primary',
  className,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="md"
      loading={pending}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
