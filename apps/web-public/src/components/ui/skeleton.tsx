import { cn } from '@/lib/cn';
import { Container } from '@/components/ui/Container';

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

/* ── The new design's pieces (2026-11-13): every loading screen takes the shape
   of its page — the deep rounded hero, the overlapping filter bar, the cards. ── */

/** A block on a deep hero panel. */
export function SkeletonDark({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton skeleton-dark rounded-lg', className)} />;
}

/** The deep rounded panel of ListHero / the detail heroes, with placeholder lines inside. */
export function SkeletonDeepPanel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn('relative overflow-hidden rounded-[1.75rem]', className)}
      style={{ background: 'color-mix(in srgb, rgb(var(--c-navy)) 50%, black)' }}
    >
      {children}
    </div>
  );
}

/** A ListHero whose title comes from data (custom pages): breadcrumb, title and a line as placeholders. */
export function SkeletonListHero() {
  return (
    <section className="pt-24 sm:pt-28">
      <Container>
        <SkeletonDeepPanel className="px-6 pb-24 pt-9 sm:px-12 sm:pb-28 sm:pt-11">
          <SkeletonDark className="h-3.5 w-28 rounded-full" />
          <SkeletonDark className="mt-5 h-10 w-2/3 max-w-md rounded-full sm:h-12" />
          <SkeletonDark className="mt-4 h-4 w-1/2 max-w-sm rounded-full" />
        </SkeletonDeepPanel>
      </Container>
    </section>
  );
}

/** The white filter bar that overlaps a hero's lower edge (fields + the dark search button). */
export function SkeletonFilterBar({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-wrap items-center gap-3 rounded-[22px] border border-hairline bg-surface p-3 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.3)] sm:flex-nowrap', className)}>
      <Skeleton className="h-12 w-full rounded-2xl sm:w-auto sm:flex-[1.6]" />
      {Array.from({ length: fields - 1 }).map((_, i) => (
        <Skeleton key={i} className="hidden h-12 flex-1 rounded-2xl sm:block" />
      ))}
      <div className="h-12 w-24 shrink-0 rounded-2xl bg-navy" />
    </div>
  );
}

/** The count + sort row above a listing grid. */
export function SkeletonToolbar() {
  return (
    <div aria-hidden className="mb-6 flex items-center justify-between gap-4">
      <Skeleton className="h-4 w-32 rounded-full" />
      <Skeleton className="h-10 w-36 rounded-full" />
    </div>
  );
}

/** A ProjectCard / UnitCard: 22px radius, photo on top, name, place, figures. */
export function SkeletonListingCard({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex h-full flex-col overflow-hidden rounded-[22px] border border-hairline bg-surface', className)}>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-3 w-1/4 rounded-full" />
        <Skeleton className="h-5 w-2/3 rounded-full" />
        <div className="mt-auto flex items-center justify-between border-t border-hairline pt-4">
          <Skeleton className="h-5 w-1/3 rounded-full" />
          <Skeleton className="h-3 w-1/5 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A grid of listing cards, three across on desktop. */
export function SkeletonListingGrid({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListingCard key={i} />
      ))}
    </div>
  );
}

/** An account page's own heading (title + one line) — every account page starts with it. */
export function SkeletonPageHeading({ action = false }: { action?: boolean }) {
  return (
    <div aria-hidden className="mb-8 flex items-end justify-between gap-4">
      <div className="space-y-3">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-3.5 w-64 max-w-full rounded-full" />
      </div>
      {action && <Skeleton className="h-9 w-32 rounded-full" />}
    </div>
  );
}

/**
 * A project / unit page while it loads: breadcrumb, the deep photo hero with
 * the name at its foot, then the text column beside the booking card (deep
 * head, white body) — the detail pages' own layout.
 */
export function SkeletonDetailPage() {
  return (
    <div aria-hidden>
      <section className="bg-canvas pt-20 sm:pt-24">
        <Container>
          <Skeleton className="mb-5 h-3.5 w-40 rounded-full" />
          <SkeletonDeepPanel className="flex flex-col justify-end p-6 sm:p-10">
            <div className="flex-1" style={{ minHeight: 'calc(clamp(280px, 32vw, 440px) - 9rem)' }} />
            <SkeletonDark className="h-3.5 w-32 rounded-full" />
            <SkeletonDark className="mt-4 h-10 w-1/2 max-w-md rounded-full" />
          </SkeletonDeepPanel>
        </Container>
      </section>
      <section className="bg-canvas pb-20 pt-8 sm:pt-10">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-8">
              <div className="space-y-3">
                <Skeleton className="h-3.5 w-20 rounded-full" />
                <Skeleton className="h-8 w-48 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
              <SkeletonText lines={4} />
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-hairline bg-surface">
              <SkeletonDeepPanel className="rounded-none p-6">
                <SkeletonDark className="h-3.5 w-24 rounded-full" />
                <SkeletonDark className="mt-4 h-8 w-40 rounded-full" />
              </SkeletonDeepPanel>
              <div className="space-y-4 p-6">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-5/6 rounded-full" />
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
