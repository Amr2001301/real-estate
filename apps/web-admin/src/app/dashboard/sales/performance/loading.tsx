import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function SalesPerformanceLoading() {
  return <ListPageSkeleton kpis={0} cols={6} rows={8} />;
}
