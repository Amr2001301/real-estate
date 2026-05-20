import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function InventoryLoading() {
  return <ListPageSkeleton kpis={6} cols={6} rows={8} />;
}
