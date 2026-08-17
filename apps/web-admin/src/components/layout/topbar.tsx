import { HelpCircle, Search } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { IconButton } from '@/components/ui/icon-button';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';
import { LangToggle } from '@/components/ui/lang-toggle';
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

export async function Topbar({ user, locale, notificationsHref, leading }: Props) {
  const unread = await getUnreadCount();
  const m = uiT(locale);
  return (
    <header className="shrink-0 z-30 h-[72px] bg-canvas/96 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/[0.07] shadow-[0_1px_0_0_rgb(15_30_51/_0.05),0_2px_20px_-6px_rgb(15_30_51/_0.07)]">
      <div className="h-full px-5 sm:px-7 lg:px-8 flex items-center gap-4">
        {leading && <div className="lg:hidden shrink-0">{leading}</div>}

        {/* Search — pill, luxury command feel */}
        <div className="hidden md:flex items-center flex-1 max-w-[500px] mx-auto">
          <div className="relative w-full group">
            <Search
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-4 my-auto h-[15px] w-[15px] text-slate-300 group-focus-within:text-brand-400/70 transition-colors duration-200"
            />
            <input
              type="search"
              placeholder={m.topbar.search}
              aria-label={m.topbar.search}
              className="h-[42px] w-full ps-10 pe-5 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-white/55 dark:bg-white/[0.05] text-[13.5px] placeholder:text-slate-300 dark:placeholder:text-white/25 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-brand-400/40 focus:bg-white/90 dark:focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgb(200_162_75/_0.07)] transition-all duration-200 shadow-[inset_0_1px_3px_rgb(0_0_0/_0.04),0_1px_2px_rgb(0_0_0/_0.02)]"
            />
          </div>
        </div>

        <div className="flex md:hidden flex-1" />

        {/* Action cluster — refined spacing */}
        <div className="flex items-center gap-1.5 ms-auto shrink-0">
          <IconButton
            label={m.topbar.help}
            variant="ghost"
            size="md"
            className="hidden sm:inline-flex text-slate-400/70 hover:text-slate-600 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] dark:hover:text-slate-300 rounded-xl transition-colors duration-150"
          >
            <HelpCircle />
          </IconButton>

          <LangToggle current={locale} />

          <NotificationBell href={notificationsHref} initialCount={unread} />

          <div className="h-[18px] w-px bg-slate-200/80 dark:bg-white/10 mx-1 hidden sm:block" />

          <UserMenu user={{ fullName: user.fullName, role: user.role }} />
        </div>
      </div>
    </header>
  );
}
