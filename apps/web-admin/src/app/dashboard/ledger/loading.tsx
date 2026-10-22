import { ListPageSkeleton } from '@/components/ui/skeletons';

export default function LedgerLoading() {
  return <ListPageSkeleton kpis={5} cols={7} rows={10} />;
}
