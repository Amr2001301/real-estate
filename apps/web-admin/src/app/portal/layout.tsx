import { requireBroker } from '@/lib/session';
import { AppShell } from '@/components/layout/app-shell';
import { BROKER_NAV_SECTIONS } from '@/lib/nav';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBroker();
  return (
    <AppShell user={user} navSections={BROKER_NAV_SECTIONS}>
      {children}
    </AppShell>
  );
}
