import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function ReservationsLoading() {
  return <ListPageSkeleton kpis={4} cols={7} rows={10} />;
}
