import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function VisitsLoading() {
  return <ListPageSkeleton kpis={4} cols={6} rows={8} />;
}
