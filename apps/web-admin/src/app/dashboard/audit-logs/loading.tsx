import { AdminTablePageSkeleton } from '@/components/ui/skeletons';

export default function AuditLogsLoading() {
  return <AdminTablePageSkeleton cols={7} filterFields={6} rows={10} />;
}
