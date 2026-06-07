import { HelpCircle, Search } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import { IconButton } from '@/components/ui/icon-button';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';
import { api } from '@/lib/api';

interface Props {
  user: SessionUser;
  notificationsHref: string;
  /** Slot rendered on mobile (hamburger). Hidden on lg+. */
  leading?: React.ReactNode;
}

async function getUnreadCount(): Promise<number> {
  try {
    // Dedicated count endpoint → { count }. (The list endpoint is paginated, so
    // counting its rows was wrong/always-0.)
    const res = await api.get<{ count: number }>('/me/notifications/unread-count');
    return Number(res.count) || 0;
  } catch {
    return 0;
  }
}

export async function Topbar({ user, notificationsHref, leading }: Props) {
  const unread = await getUnreadCount();
  return (
    <header className="sticky top-0 z-30 h-[72px] bg-canvas/95 backdrop-blur-md border-b border-hairline shadow-soft">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center gap-3">
        {leading && <div className="lg:hidden shrink-0">{leading}</div>}

        <div className="hidden md:flex items-center flex-1 max-w-xl mx-auto">
          <div className="relative w-full">
            <Search
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-4 w-4 text-slate-400"
            />
            <input
              type="search"
              placeholder="بحث عن وحدات، عملاء، مشاريع…"
              aria-label="بحث"
              className="h-10 w-full ps-10 pe-3 rounded-xl border border-hairline/80 bg-white/90 text-sm placeholder:text-slate-400 text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors shadow-xs"
            />
          </div>
        </div>

        <div className="flex md:hidden flex-1" />

        <div className="flex items-center gap-1.5 ms-auto shrink-0">
          <IconButton label="المساعدة" variant="ghost" size="md" className="hidden sm:inline-flex text-slate-500 hover:text-navy">
            <HelpCircle />
          </IconButton>

          <NotificationBell href={notificationsHref} initialCount={unread} />

          <div className="h-5 w-px bg-hairline mx-1 hidden sm:block" />

          <UserMenu user={{ fullName: user.fullName, role: user.role }} />
        </div>
      </div>
    </header>
  );
}
