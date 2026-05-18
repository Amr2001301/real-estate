import { requireBroker } from '@/lib/session';
import { AppShell } from '@/components/layout/app-shell';
import { BROKER_NAV_SECTIONS, filterBrokerNavForFlags } from '@/lib/nav';
import { api, safe } from '@/lib/api';
import type { PortalMe } from '@/lib/types';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBroker();

  // Fetch the broker user's flags so the sidebar can hide items the user
  // can't reach. The backend enforces the same rules via BrokerManagerGuard
  // and BrokerCommissionsViewerGuard — this is purely cosmetic.
  const me = await safe(api.get<PortalMe>('/portal/me'));
  const navSections = me.data
    ? filterBrokerNavForFlags({
        canManageBrokerUsers: me.data.brokerUser.canManageBrokerUsers,
        isPrimaryContact: me.data.brokerUser.isPrimaryContact,
        canViewCommissions: me.data.brokerUser.canViewCommissions,
      })
    : BROKER_NAV_SECTIONS;

  return (
    <AppShell user={user} navSections={navSections}>
      {children}
    </AppShell>
  );
}
