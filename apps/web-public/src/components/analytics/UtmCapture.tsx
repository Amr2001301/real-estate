'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captureUtm } from '@/lib/utm';

/** Keeps an ad click's tracking tags from whichever page the visitor lands on, for the forms to send later. */
export function UtmCapture() {
  const pathname = usePathname();

  useEffect(() => {
    captureUtm();
  }, [pathname]);

  return null;
}
