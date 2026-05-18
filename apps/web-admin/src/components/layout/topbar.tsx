import Link from 'next/link';
import { Bell, HelpCircle, Search } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import { IconButton } from '@/components/ui/icon-button';
import { UserMenu } from './user-menu';
import { api } from '@/lib/api';
import type { NotificationItem } from '@/lib/types';

interface Props {
  user: SessionUser;
  notificationsHref: string;
  /** Slot rendered on mobile (hamburger). Hidden on lg+. */
  leading?: React.ReactNode;
}

async function getUnreadCount(): Promise<number> {
  try {
    const items = await api.get<NotificationItem[]>('/me/notifications?unreadOnly=1');
    return items.length;
  } catch {
    return 0;
  }
}

export async function Topbar({ user, notificationsHref, leading }: Props) {
  const unread = await getUnreadCount();
  return (
    <header className="sticky top-0 z-30 h-[72px] bg-surface/85 backdrop-blur-md border-b border-hairline">
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
              className="h-10 w-full ps-10 pe-3 rounded-xl border border-hairline bg-surface-muted text-sm placeholder:text-slate-400 focus:outline-none focus:bg-surface focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors"
            />
          </div>
        </div>

        <div className="flex md:hidden flex-1" />

        <div className="flex items-center gap-1.5 ms-auto shrink-0">
          <IconButton label="المساعدة" variant="ghost" size="md" className="hidden sm:inline-flex">
            <HelpCircle />
          </IconButton>

          <Link href={notificationsHref as never} className="relative inline-flex">
            <IconButton label="الإشعارات" variant="ghost" size="md">
              <Bell />
            </IconButton>
            {unread > 0 && (
              <span
                aria-label={`${unread} إشعار غير مقروء`}
                className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-semibold ring-2 ring-surface tabular-nums"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>

          <div className="h-7 w-px bg-hairline mx-1.5 hidden sm:block" />

          <UserMenu user={{ fullName: user.fullName, role: user.role }} />
        </div>
      </div>
    </header>
  );
}
