import {
  PageHeaderSkeleton,
  KpiCardsSkeleton,
  ChartsRowSkeleton,
  TableCardSkeleton,
} from '@/components/ui/skeletons';

export default function DashboardHomeLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiCardsSkeleton count={4} />
      <ChartsRowSkeleton />
      <TableCardSkeleton cols={5} rows={6} />
    </div>
  );
}
