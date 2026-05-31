import { cn } from '@/lib/cn';

/**
 * Shared skeleton/shimmer primitives for web-public loading states. The `.skeleton`
 * class (globals.css) provides a surface-soft block with a gradient sweep that
 * respects prefers-reduced-motion. All pieces are decorative (`aria-hidden`);
 * pages should add their own screen-reader loading text where useful.
 *
 * Compose with Tailwind classes (height/width/radius) to mirror the real
 * component being replaced. Keep usage simple — don't over-parametrize.
 */

/** A single shimmer block. Pass sizing/radius via className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} />;
}

/** A few text lines of decreasing emphasis (last line shorter). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5 rounded-full', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Image + text card — mirrors ProjectCard / UnitCard. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('overflow-hidden rounded-3xl border border-hairline bg-surface shadow-soft', className)}
    >
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-6">
        <Skeleton className="h-3 w-1/3 rounded-full" />
        <Skeleton className="h-5 w-2/3 rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="mt-4 h-7 w-1/2 rounded-full" />
      </div>
    </div>
  );
}

/** Stacked list rows (icon tile + two lines) — mirrors favorites/visits/etc. */
export function SkeletonList({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface p-5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Summary-tile grid — mirrors the dense dashboard SummaryTile (value leads, icon on the end). */
export function SkeletonStat({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-2xl border border-hairline bg-surface p-5">
          <div className="space-y-2.5">
            <Skeleton className="h-7 w-12 rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Labeled fields + submit — mirrors profile / maintenance / contact forms. */
export function SkeletonForm({ fields = 3, className }: { fields?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-5', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ))}
      <Skeleton className="h-12 w-40 rounded-full" />
    </div>
  );
}
