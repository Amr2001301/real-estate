import { BrokerListPageSkeleton } from '@/components/ui/skeletons';

export default function BrokerReservationsLoading() {
  return <BrokerListPageSkeleton cols={9} filterFields={4} hasAction />;
}
