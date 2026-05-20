import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function DepositsLoading() {
  return <ListPageSkeleton kpis={3} cols={6} rows={8} />;
}
