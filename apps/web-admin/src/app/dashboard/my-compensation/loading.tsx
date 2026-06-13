import { PageHeaderSkeleton, KpiCardsSkeleton, TableCardSkeleton } from '@/components/ui/skeletons';

export default function MyCompensationLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <KpiCardsSkeleton count={4} />
      <TableCardSkeleton cols={7} rows={5} />
      <TableCardSkeleton cols={7} rows={4} />
    </div>
  );
}
