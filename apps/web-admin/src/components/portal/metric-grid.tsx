import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A row of figures as one navy band split by gold hairlines (U5, like PremiumMetricStrip). */
export function MetricGrid({
  cols = 4,
  className,
  children,
}: {
  cols?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-[22px] border border-[#D8B66A]/[0.28] bg-[#D8B66A]/[0.16]',
        'shadow-[0_22px_44px_-24px_rgb(10_17_32/0.55)]',
        cols === 2 && 'grid-cols-2',
        cols === 3 && 'grid-cols-3',
        cols === 4 && 'grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  /** Kept for API compatibility — the band shows every value in one colour. */
  variant: _variant = 'default',
  size = 'sm',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  variant?: 'default' | 'accent' | 'highlight';
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="bg-navy-band px-5 py-5">
      <p className="text-[13px] leading-snug text-[#A9B0BD]">{label}</p>
      <p
        className={cn(
          'num mt-1 font-semibold leading-none text-[#F4ECD8]',
          size === 'sm' && 'text-[22px]',
          size === 'md' && 'text-[30px]',
          size === 'lg' && 'text-[40px]',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-[12px] text-[#A9B0BD]">{sub}</p>}
    </div>
  );
}
