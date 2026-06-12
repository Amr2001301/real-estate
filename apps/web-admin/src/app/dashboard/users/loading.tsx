import { AdminTablePageSkeleton } from '@/components/ui/skeletons';

export default function UsersLoading() {
  return <AdminTablePageSkeleton cols={8} filterFields={3} rows={12} hasAction />;
}
