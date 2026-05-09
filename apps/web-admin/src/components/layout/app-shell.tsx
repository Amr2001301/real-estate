import type { ReactNode } from 'react';
import type { SessionUser } from '@/lib/session';
import { ToastProvider } from '@/components/ui/toast';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNav } from './mobile-nav';

interface Props {
  user: SessionUser;
  children: ReactNode;
}

export function AppShell({ user, children }: Props) {
  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-canvas">
        <Sidebar user={user} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar user={user} leading={<MobileNav user={user} />} />
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
