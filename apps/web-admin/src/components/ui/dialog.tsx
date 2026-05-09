'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className={cn(
          'relative w-full bg-surface rounded-2xl shadow-xl border border-hairline',
          SIZE[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="px-6 pt-5 pb-4 border-b border-hairline">
            {title && (
              <h2
                id="dialog-title"
                className="text-base font-semibold text-slate-900 tracking-tight"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-slate-500 mt-1">{description}</p>
            )}
          </div>
        )}
        {children && <div className="p-6">{children}</div>}
        {footer && (
          <div className="px-6 py-4 border-t border-hairline flex items-center justify-end gap-2 bg-surface-muted/40 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
