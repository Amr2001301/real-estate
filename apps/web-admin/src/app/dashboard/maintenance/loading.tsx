import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function MaintenanceLoading() {
  return <ListPageSkeleton kpis={4} cols={6} rows={8} />;
}
