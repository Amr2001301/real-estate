import { api, safe } from '@/lib/api';
import type { Paged } from '@/lib/types';
import { requireAdmin } from '@/lib/session';
import { getDisabledFeatures } from '@/lib/capabilities';
import { filterNavForRole } from '@/lib/nav';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const disabled = await getDisabledFeatures(user.role);
  const sections = filterNavForRole(user.role, disabled);
  // How many customer payment proofs wait for an admin, beside its nav item.
  if (user.role === 'ADMIN') {
    const waiting = (await safe(api.get<Paged<unknown>>('/deposits/review-queue?pageSize=1'))).data?.meta.total ?? 0;
    for (const sec of sections)
      for (const it of sec.items) if (it.href === '/dashboard/payments/review') it.badge = waiting;
  }
  return (
    <AppShell user={user} navSections={sections}>
      {children}
    </AppShell>
  );
}
