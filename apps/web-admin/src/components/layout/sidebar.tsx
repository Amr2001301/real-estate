import { LogOut } from 'lucide-react';
import type { SessionUser, SessionRole } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import { filterNavForRole, type NavSection } from '@/lib/nav';
import { uiT } from '@/messages/ui';
import { logoutAction } from '@/app/login/actions';
import { Brand } from './brand';
import { NavLink } from './nav-link';

interface Props {
  user: SessionUser;
  locale: Locale;
  /** Optional override for nav sections. Falls back to filterNavForRole(user.role). */
  sections?: NavSection[];
  onNavigate?: () => void;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function SidebarContent({ user, locale, sections, onNavigate }: Props) {
  const resolved = sections ?? filterNavForRole(user.role);
  const m = uiT(locale);

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
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-5">
        {resolved.map((section) => (
          <div key={section.titleKey}>
            <p className="px-3 mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-sidebar-text-muted select-none">
              {m.nav.sections[section.titleKey]}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                // U5: text + ring, no icons (the mockup's quieter sidebar).
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={m.nav.items[item.labelKey]}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card + logout at the bottom (U5); the top bar no longer repeats the name. */}
      <div className="border-t border-white/[0.06] px-3 py-3 shrink-0 space-y-1">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B66A] to-[#B38B3A] text-[#1A1408] text-[13px] font-bold shrink-0">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white truncate leading-snug">{user.fullName}</p>
            <p className="text-[11px] text-[#D8B66A]/85 truncate">{m.sidebar.roles[user.role as SessionRole]}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[12.5px] font-medium text-sidebar-text/70 hover:text-white/90 hover:bg-white/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-70" aria-hidden />
            {m.sidebar.logout}
          </button>
        </form>
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
