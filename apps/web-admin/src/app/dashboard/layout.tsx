import { requireAdmin } from '@/lib/session';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AppShell user={user}>{children}</AppShell>;
}
