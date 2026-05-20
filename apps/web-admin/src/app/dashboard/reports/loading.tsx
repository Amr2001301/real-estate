import {
  PageHeaderSkeleton,
  KpiCardsSkeleton,
  ChartsRowSkeleton,
} from '@/components/ui/skeletons';

export default function ReportsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiCardsSkeleton count={4} />
      <ChartsRowSkeleton />
      <ChartsRowSkeleton />
    </div>
  );
}
