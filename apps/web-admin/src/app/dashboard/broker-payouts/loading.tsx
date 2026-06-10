import { BrokerListPageSkeleton } from '@/components/ui/skeletons';

export default function BrokerPayoutsLoading() {
  return <BrokerListPageSkeleton cols={9} filterFields={5} hasAction />;
}
