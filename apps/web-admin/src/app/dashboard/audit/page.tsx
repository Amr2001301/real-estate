import { redirect } from 'next/navigation';

// Legacy `/dashboard/audit` route. Replaced by the richer `/dashboard/audit-logs`
// viewer in Phase 15. Kept as a permanent redirect so old bookmarks resolve.
export default function LegacyAuditRedirect() {
  redirect('/dashboard/audit-logs');
}
