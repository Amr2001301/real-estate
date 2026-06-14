'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollReset({ containerId }: { containerId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById(containerId)?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, containerId]);
  return null;
}
