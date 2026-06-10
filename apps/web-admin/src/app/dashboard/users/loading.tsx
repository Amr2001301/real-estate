import { AdminTablePageSkeleton } from '@/components/ui/skeletons';

export default function UsersLoading() {
  return <AdminTablePageSkeleton cols={8} filterFields={1} rows={12} />;
}
