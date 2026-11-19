import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import { filterNavForRole, type NavSection } from '@/lib/nav';
import { uiT } from '@/messages/ui';
import { initials } from '@/lib/initials';
import { NotificationBell } from './notification-bell';
import { TopbarCrumbs } from './topbar-crumbs';
import { LangToggle } from '@/components/ui/lang-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GOLD_ACTION } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';

interface Props {
  user: SessionUser;
  locale: Locale;
  notificationsHref: string;
  /** The same menu as the sidebar (for the breadcrumb and the assistant button). */
  sections?: NavSection[];
  /** Slot rendered on mobile (hamburger). Hidden on lg+. */
  leading?: React.ReactNode;
}

async function getUnreadCount(): Promise<number> {
  try {
    const res = await api.get<{ count: number }>('/me/notifications/unread-count');
    return Number(res.count) || 0;
  } catch (e) {
    unstable_rethrow(e);
    return 0;
  }
}

/**
 * The bar above every page (the Devora look): where you are on the start
 * side; search, the AI assistant, light/dark, language, notifications and
 * you on the end side.
 */
export async function Topbar({ user, locale, notificationsHref, sections, leading }: Props) {
  const unread = await getUnreadCount();
  const m = uiT(locale);
  const nav = sections ?? filterNavForRole(user.role);
  const crumbSections = nav.map((s) => ({
    title: m.nav.sections[s.titleKey],
    items: s.items.map((i) => ({ href: i.href, label: m.nav.items[i.labelKey], matches: i.matches })),
  }));
  const assistant = nav.flatMap((s) => s.items).find((i) => i.href === '/dashboard/assistant');
  const home = user.role === 'BROKER' ? '/portal' : '/dashboard';
  return (
    <header className="z-30 h-[76px] shrink-0 border-b border-hairline bg-canvas/85 backdrop-blur-xl">
      <div className="flex h-full items-center gap-2.5 px-5 sm:px-9">
        {leading && <div className="shrink-0 lg:hidden">{leading}</div>}

        <TopbarCrumbs sections={crumbSections} home={{ href: home, label: m.nav.items.dashboard ?? 'Home' }} />

        <div className="flex-1" />

        {/* Search: the platform owner has no company data to search. */}
        {user.role !== 'SUPER_ADMIN' && (
          <div className="group relative hidden w-[340px] shrink md:block">
            <Search
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-4 my-auto h-4 w-4 text-slate-500 transition-colors group-focus-within:text-[#8A6823]"
            />
            <input
              type="search"
              placeholder={m.topbar.search}
              aria-label={m.topbar.search}
              className="h-[42px] w-full rounded-full border border-hairline bg-surface ps-11 pe-14 text-[13px] text-slate-900 shadow-[0_1px_2px_rgb(11_18_32/0.10),0_4px_12px_-4px_rgb(11_18_32/0.12)] transition-all placeholder:text-slate-500 focus:border-[#C8A24B]/60 focus:outline-none focus:shadow-[0_0_0_3px_rgb(200_162_75/0.12)] dark:shadow-none [&::-webkit-search-cancel-button]:hidden"
            />
            <kbd aria-hidden className="pointer-events-none absolute inset-y-0 end-3 my-auto h-fit rounded-md border border-hairline px-1.5 py-px font-[Inter,system-ui,sans-serif] text-[11px] text-slate-500">⌘K</kbd>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2.5">
          {assistant && (
            <Link
              href={assistant.href as never}
              prefetch={false}
              className={cn(GOLD_ACTION, 'hidden h-[42px] items-center gap-2 rounded-full px-4 text-[13px] sm:inline-flex')}
            >
              <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
              {locale === 'en' ? 'Assistant' : 'المساعد'}
            </Link>
          )}
          <ThemeToggle
            labels={{ light: m.topbar.light, dark: m.topbar.dark, toLight: m.topbar.lightMode, toDark: m.topbar.darkMode }}
          />
          <LangToggle current={locale} />
          <NotificationBell href={notificationsHref} initialCount={unread} />
          <span aria-hidden className="mx-1 hidden h-7 w-px bg-hairline sm:block" />
          <span
            title={user.fullName}
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#E2C792]/25 bg-[linear-gradient(135deg,#C8A24B,#8A6A23)] text-[14px] font-semibold text-[#F4EFE4] sm:inline-flex"
          >
            {initials(user.fullName, { single: 2, fallback: '·' })}
          </span>
        </div>
      </div>
    </header>
  );
}
