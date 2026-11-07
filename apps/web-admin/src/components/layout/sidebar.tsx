import type { SessionUser, SessionRole } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import { filterNavForRole, SECTION_ICONS, type NavSection } from '@/lib/nav';
import { uiT } from '@/messages/ui';
import { logoutAction } from '@/app/login/actions';
import { Brand } from './brand';
import { NavSections } from './nav-sections';
import { UserMenu } from './user-menu';
import { initials } from '@/lib/initials';

interface Props {
  user: SessionUser;
  locale: Locale;
  /** Optional override for nav sections. Falls back to filterNavForRole(user.role). */
  sections?: NavSection[];
  onNavigate?: () => void;
  className?: string;
}

export function SidebarContent({ user, locale, sections, onNavigate }: Props) {
  const all = sections ?? filterNavForRole(user.role);
  const m = uiT(locale);
  // The settings page lives in the account menu at the foot, not in the list.
  const settingsItem = all.flatMap((s) => s.items).find((i) => i.labelKey === 'settings');
  const resolved = all
    .map((s) => ({ ...s, items: s.items.filter((i) => i.labelKey !== 'settings') }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col h-full bg-sidebar-bg text-sidebar-text border-e border-[#D8B66A]/[0.18]">

      {/* Brand header — matches topbar height (72px) for visual alignment */}
      <div className="px-5 h-[84px] flex items-center shrink-0">
        {/* A broker signs in to the brokers' portal, not the admins'. */}
        {user.role === 'BROKER' ? (
          <Brand theme="dark" href="/portal" subtitle={locale === 'en' ? 'Broker portal' : 'بوابة الوسطاء'} />
        ) : (
          <Brand theme="dark" />
        )}
      </div>

      {/* Navigation */}
      {/* One section open at a time, each with its icon; a search box finds any page. */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <NavSections
          sections={resolved.map((section) => ({
            key: section.titleKey,
            title: m.nav.sections[section.titleKey],
            iconKey: SECTION_ICONS[section.titleKey],
            flat: section.flat || resolved.length === 1,
            items: section.items.map((item) => ({
              href: item.href,
              label: m.nav.items[item.labelKey],
              iconKey: item.iconKey,
              badge: item.badge,
              matches: item.matches,
            })),
          }))}
          searchPlaceholder={m.nav.search}
          noResults={m.nav.noResults}
          onNavigate={onNavigate}
        />
      </nav>

      {/* One row at the foot: the person, and a menu with settings, security and sign out. */}
      <div className="border-t border-white/[0.06] px-3 py-3 shrink-0">
        <UserMenu
          name={user.fullName}
          role={m.sidebar.roles[user.role as SessionRole]}
          initials={initials(user.fullName, { single: 2, fallback: '·' })}
          settings={settingsItem ? { href: settingsItem.href, label: m.nav.items[settingsItem.labelKey], matches: settingsItem.matches } : undefined}
          security={{ href: user.role === 'BROKER' ? '/portal/security' : '/dashboard/security', label: m.sidebar.security }}
          logout={{ label: m.sidebar.logout, action: logoutAction }}
          onNavigate={onNavigate}
        />
      </div>

    </div>
  );
}

export function Sidebar({ user, locale, sections, className }: Omit<Props, 'onNavigate'>) {
  return (
    <aside
      className={`hidden lg:flex w-[256px] shrink-0 relative z-20 ${className ?? ''}`}
      style={{
        boxShadow: '-16px 0 40px -16px rgb(15 30 51 / 0.28)',
      }}
    >
      <div className="h-full w-full">
        <SidebarContent user={user} locale={locale} sections={sections} />
      </div>
    </aside>
  );
}
