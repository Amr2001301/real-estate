import { PageHeaderSkeleton, KpiCardsSkeleton } from '@/components/ui/skeletons';

export default function MaintenanceDetailLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <KpiCardsSkeleton count={3} />
    </div>
  );
}
