import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function ChequesLoading() {
  return <ListPageSkeleton kpis={0} cols={6} rows={8} />;
}
