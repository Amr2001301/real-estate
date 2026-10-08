'use client';

import { useFormStatus } from 'react-dom';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

interface Props {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  /** Disable the button independently of the form's pending state. */
  disabled?: boolean;
  locale?: Locale;
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className,
  disabled = false,
  locale = 'ar',
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
      {pending ? (pendingLabel ?? portalSharedT(locale).submitButton.saving) : children}
    </Button>
  );
}
