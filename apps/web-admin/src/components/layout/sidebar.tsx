import { LogOut } from 'lucide-react';
import type { SessionUser, SessionRole } from '@/lib/session';
import { filterNavForRole, NAV_ICONS, type NavSection } from '@/lib/nav';
import { logoutAction } from '@/app/login/actions';
import { Brand } from './brand';
import { NavLink } from './nav-link';

interface Props {
  user: SessionUser;
  /** Optional override for nav sections. Falls back to filterNavForRole(user.role). */
  sections?: NavSection[];
  onNavigate?: () => void;
  className?: string;
}

const ROLE_LABEL: Record<SessionRole, string> = {
  ADMIN: 'مدير النظام',
  SALES: 'مبيعات',
  SALES_MANAGER: 'مدير مبيعات',
  BROKER: 'وسيط',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function SidebarContent({ user, sections, onNavigate }: Props) {
  const resolved = sections ?? filterNavForRole(user.role);

  return (
    <div className="flex flex-col h-full bg-sidebar-bg text-sidebar-text">

      {/* Brand header — matches topbar height (72px) for visual alignment */}
      <div className="px-5 h-[72px] flex items-center border-b border-white/[0.07] shrink-0">
        <Brand theme="dark" />
      </div>

      {/* User profile card */}
      <div className="px-3 pt-3 pb-3 border-b border-white/[0.06] shrink-0">
        <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.07] ring-1 ring-white/[0.09] overflow-hidden">
          {/* Subtle gold sheen along top */}
          <span
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent"
            aria-hidden
          />
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-navy text-sm font-bold shrink-0 shadow-[0_4px_14px_-4px_rgb(200_162_75/0.55)]">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white truncate leading-snug">
              {user.fullName}
            </p>
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.09] text-brand-300/90 ring-1 ring-white/[0.12]">
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-5">
        {resolved.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-sidebar-text-muted/38 select-none">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.iconKey];
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout footer */}
      <div className="border-t border-white/[0.06] px-3 py-3 shrink-0">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-[12.5px] font-medium text-sidebar-text-muted/55 hover:text-white/85 hover:bg-white/[0.07] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-70 group-hover:opacity-100" aria-hidden />
            تسجيل الخروج
          </button>
        </form>
      </div>

    </div>
  );
}

export function Sidebar({ user, sections, className }: Omit<Props, 'onNavigate'>) {
  return (
    <aside
      className={`hidden lg:flex w-[256px] shrink-0 relative z-20 ${className ?? ''}`}
      style={{
        boxShadow: '-16px 0 40px -16px rgb(15 30 51 / 0.28)',
      }}
    >
      <div className="h-full w-full">
        <SidebarContent user={user} sections={sections} />
      </div>
    </aside>
  );
}
