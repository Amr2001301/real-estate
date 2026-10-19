import { requireAdmin } from '@/lib/session';
import { getDisabledFeatures } from '@/lib/capabilities';
import { filterNavForRole } from '@/lib/nav';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const disabled = await getDisabledFeatures(user.role);
  return (
    <AppShell user={user} navSections={filterNavForRole(user.role, disabled)}>
      {children}
    </AppShell>
  );
}
