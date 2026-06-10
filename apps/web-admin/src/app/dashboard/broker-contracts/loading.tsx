import { BrokerListPageSkeleton } from '@/components/ui/skeletons';

export default function BrokerContractsLoading() {
  return <BrokerListPageSkeleton cols={10} filterFields={5} />;
}
