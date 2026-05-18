import type { ReactNode } from 'react';
import type { SessionUser } from '@/lib/session';
import type { NavSection } from '@/lib/nav';
import { ToastProvider } from '@/components/ui/toast';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNav } from './mobile-nav';

interface Props {
  user: SessionUser;
  /** Optional override for nav sections (e.g. broker portal uses BROKER_NAV_SECTIONS). */
  navSections?: NavSection[];
  children: ReactNode;
}

export function AppShell({ user, navSections, children }: Props) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-canvas">
        <Sidebar user={user} sections={navSections} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar
            user={user}
            notificationsHref={user.role === 'BROKER' ? '/portal/notifications' : '/dashboard/notifications'}
            leading={<MobileNav user={user} sections={navSections} />}
          />
          <main className="flex-1 min-w-0">
            <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1440px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
