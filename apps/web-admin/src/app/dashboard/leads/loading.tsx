import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function LeadsLoading() {
  return <ListPageSkeleton kpis={4} cols={6} rows={10} />;
}
