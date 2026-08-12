'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

interface Props {
  event: string;
  params?: Record<string, unknown>;
}

/** Fires a single analytics event on mount — used for project_view / unit_view. */
export function ViewTracker({ event, params = {} }: Props) {
  useEffect(() => {
    trackEvent(event, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
