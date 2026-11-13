import { AccountCard } from '@/components/account/AccountCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Account pages while they load (2026-11-13): the page's own heading (its real
 * title — known before any data), then placeholders in the page's own cards
 * (AccountCard with its rail), so the loading screen is the page minus its data.
 */
export function AccountLoadingPage({
  title,
  description,
  loadingLabel,
  action = false,
  children,
}: {
  title: string;
  description?: string;
  loadingLabel: string;
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="sr-only">{loadingLabel}</span>
      <AccountPageHeader
        title={title}
        description={description}
        actions={action ? <Skeleton className="h-10 w-36 rounded-full" /> : undefined}
      />
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** A contract / reservation card: icon, number and place, the download pill, a soft box of figures, a footer of dates. */
export function RecordCardSkeleton() {
  return (
    <AccountCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-44 rounded-full" />
            <Skeleton className="h-3 w-56 max-w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-surface-soft/60 p-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="mt-4 flex justify-between border-t border-hairline pt-4">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="hidden h-3 w-20 rounded-full sm:block" />
      </div>
    </AccountCard>
  );
}

/** A simple list card (visit, request, favourite, maintenance request): icon, two lines, a status pill. */
export function RowCardSkeleton() {
  return (
    <AccountCard className="p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </AccountCard>
  );
}

export function RowCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <RowCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** The figures card at the top of «المدفوعات» (four figures, gold rail). */
export function FiguresCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <AccountCard className="p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-2.5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </AccountCard>
  );
}

/** A row of filter chips. */
export function ChipsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-full" />
      ))}
    </div>
  );
}
