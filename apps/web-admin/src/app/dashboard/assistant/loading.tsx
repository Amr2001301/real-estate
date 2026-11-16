import { BlockCardSkeleton } from '@/components/ui/skeletons';

/** A faint bar on the navy console. */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className}`} />;
}

/**
 * /dashboard/assistant while it loads — its own shape: the navy console
 * (mark and title, greeting, the question box, four suggestions) and the two
 * side cards.
 */
export default function Loading() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-[28px] bg-navy-band p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-white/10 ring-1 ring-[#D8B66A]/30" />
          <div className="flex-1 space-y-3">
            <Bar className="h-3 w-40" />
            <Bar className="h-7 w-56" />
          </div>
        </div>
        <div className="mt-10 space-y-3">
          <Bar className="h-6 w-60" />
          <Bar className="h-3.5 w-3/4" />
        </div>
        <div className="mt-6 h-[92px] animate-pulse rounded-card bg-white/[0.07] ring-1 ring-inset ring-white/10" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, k) => (
            <div key={k} className="h-[62px] animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/10" />
          ))}
        </div>
      </section>
      <div className="flex flex-col gap-6">
        <BlockCardSkeleton h={330} />
        <BlockCardSkeleton h={210} />
      </div>
    </div>
  );
}
