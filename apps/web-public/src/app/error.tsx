'use client';

import { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { ErrorState } from '@/components/states/ErrorState';
import { FRIENDLY } from '@/lib/api';

/** Route-level error boundary. Shows a friendly branded panel, never the raw error. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[route-error]', error);
    }
  }, [error]);

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-24">
      <ErrorState
        title="حدث خطأ غير متوقع"
        message={`${FRIENDLY.unexpected} ${FRIENDLY.retry}`}
        onRetry={reset}
        className="w-full max-w-lg"
      />
    </Container>
  );
}
