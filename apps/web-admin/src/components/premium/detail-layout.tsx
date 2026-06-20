import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PremiumDetailLayoutProps {
  /** Main content area — occupies 2/3 width on xl screens (right in RTL) */
  main: ReactNode;
  /** Side panel — occupies 1/3 width on xl screens (left in RTL), sticky by default */
  side: ReactNode;
  /** Whether the side panel should be sticky. Default: true */
  sideSticky?: boolean;
  className?: string;
}

export function PremiumDetailLayout({
  main,
  side,
  sideSticky = true,
  className,
}: PremiumDetailLayoutProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start',
        className,
      )}
    >
      {/* Main — first in DOM = right side in RTL grid */}
      <div className="xl:col-span-2 flex flex-col gap-5">{main}</div>

      {/* Side panel */}
      <div
        className={cn(
          'xl:col-span-1 flex flex-col gap-4',
          sideSticky && 'xl:sticky xl:top-6 self-start',
        )}
      >
        {side}
      </div>
    </div>
  );
}
