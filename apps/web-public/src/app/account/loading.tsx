import { Skeleton, SkeletonDark, SkeletonDeepPanel } from '@/components/ui/skeleton';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { accountT } from '@/messages/account';

/** A dashboard panel: title and link over a few rows. */
function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="rounded-[1.5rem] border border-hairline bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-3.5 w-14 rounded-full" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * «لوحة الحساب» while it loads, in its own shape: for an owner the unit card
 * beside the deep «next instalment» card, the figures strip and the panels;
 * for a visitor the deep «start your journey» card, then the panels.
 */
export default async function AccountDashboardLoading() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const t = accountT(locale);
  const owner = session?.role === 'CUSTOMER';
  return (
    <div className="space-y-6">
      <span className="sr-only">{t.loading}</span>
      {owner ? (
        <>
          <div aria-hidden className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="flex flex-col overflow-hidden rounded-[1.5rem] border border-hairline bg-surface sm:flex-row">
              <Skeleton className="h-48 rounded-none sm:h-auto sm:w-[42%]" />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <Skeleton className="h-3.5 w-16 rounded-full" />
                <Skeleton className="h-7 w-3/4 rounded-full" />
                <Skeleton className="h-3.5 w-1/2 rounded-full" />
                <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
                <Skeleton className="mt-6 h-3.5 w-1/3 rounded-full" />
              </div>
            </div>
            <SkeletonDeepPanel className="flex min-h-[260px] flex-col rounded-[1.5rem] p-6">
              <div className="flex items-center justify-between">
                <SkeletonDark className="h-3.5 w-24 rounded-full" />
                <SkeletonDark className="h-6 w-16 rounded-full" />
              </div>
              <SkeletonDark className="mt-4 h-10 w-48 rounded-full" />
              <SkeletonDark className="mt-3 h-3.5 w-28 rounded-full" />
              <div className="mt-auto space-y-2.5 pt-6">
                <div className="h-12 rounded-2xl bg-gold-400/70" />
                <SkeletonDark className="h-11 rounded-2xl" />
              </div>
            </SkeletonDeepPanel>
          </div>
          <div
            aria-hidden
            className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-hairline bg-hairline lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 bg-surface px-5 py-4">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <SkeletonDeepPanel className="rounded-[1.5rem] p-8 sm:p-10">
          <SkeletonDark className="h-7 w-56 rounded-full" />
          <SkeletonDark className="mt-3 h-4 w-80 max-w-full rounded-full" />
          <div className="mt-6 h-12 w-40 rounded-2xl bg-gold-400/70" />
        </SkeletonDeepPanel>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton rows={1} />
        <PanelSkeleton rows={2} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={2} />
      </div>
    </div>
  );
}
