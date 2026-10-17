import { Search } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { NotificationBell } from './notification-bell';
import { LangToggle } from '@/components/ui/lang-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { api } from '@/lib/api';

interface Props {
  user: SessionUser;
  locale: Locale;
  notificationsHref: string;
  /** Slot rendered on mobile (hamburger). Hidden on lg+. */
  leading?: React.ReactNode;
}

async function getUnreadCount(): Promise<number> {
  try {
    const res = await api.get<{ count: number }>('/me/notifications/unread-count');
    return Number(res.count) || 0;
  } catch {
    return 0;
  }
}

export async function Topbar({ locale, notificationsHref, leading }: Props) {
  const unread = await getUnreadCount();
  const m = uiT(locale);
  return (
    <header className="shrink-0 z-30 h-[84px] bg-canvas/95 backdrop-blur-xl border-b border-hairline">
      <div className="h-full px-5 sm:px-7 lg:px-10 flex items-center gap-4">
        {leading && <div className="lg:hidden shrink-0">{leading}</div>}

        {/* Search — a wide pill at the start of the bar (U5). */}
        <div className="hidden md:flex items-center flex-1 max-w-[640px]">
          <div className="relative w-full group">
            <Search
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-4 my-auto h-[15px] w-[15px] text-slate-400 group-focus-within:text-brand-700 transition-colors duration-200"
            />
            <input
              type="search"
              placeholder={m.topbar.search}
              aria-label={m.topbar.search}
              className="h-12 w-full ps-11 pe-5 rounded-full border border-hairline bg-surface text-[14px] placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-brand-400/60 focus:shadow-[0_0_0_3px_rgb(200_162_75/_0.10)] transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* Actions. The user's name and logout live in the sidebar (U5). */}
        <div className="flex items-center gap-2 shrink-0">
          <LangToggle current={locale} />
          <ThemeToggle
            labels={{ light: m.topbar.light, dark: m.topbar.dark, toLight: m.topbar.lightMode, toDark: m.topbar.darkMode }}
          />
          <NotificationBell href={notificationsHref} initialCount={unread} />
        </div>
      </div>
    </header>
  );
}
