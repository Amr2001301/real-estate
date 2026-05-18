'use client';

import { type FormHTMLAttributes, type ReactNode } from 'react';

interface Props extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** Arabic confirm dialog message shown via native window.confirm(). */
  confirmMessage: string;
  children: ReactNode;
}

/**
 * Thin client wrapper around `<form>` that gates submission with a native
 * window.confirm() prompt. Use this inside server components where we can't
 * attach an `onSubmit` to a plain `<form>`.
 */
export function ConfirmingForm({ confirmMessage, children, ...rest }: Props) {
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
