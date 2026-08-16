'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import { FRIENDLY } from '@/lib/api';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Branded, friendly error panel. Never surfaces raw error detail. */
export function ErrorState({
  title = 'Failed to load',
  message = FRIENDLY.retry,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-hairline bg-surface px-8 py-16 text-center shadow-soft',
        className,
      )}
    >
      <IconCircle tone="soft" className="mb-5 h-14 w-14">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </IconCircle>
      <h3 className="text-xl text-ink-strong">{title}</h3>
      <p className="mt-2 max-w-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-6" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Retry
        </Button>
      )}
    </div>
  );
}
