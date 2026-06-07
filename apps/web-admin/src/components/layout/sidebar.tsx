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

      {/* Brand header */}
      <div className="px-5 h-[64px] flex items-center border-b border-sidebar-border/30 shrink-0">
        <Brand theme="dark" />
      </div>

      {/* User profile card — near top, mirrors website account sidebar */}
      <div className="px-3 pt-3 pb-3 border-b border-sidebar-border/20 shrink-0">
        <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.07] ring-1 ring-white/10 overflow-hidden">
          {/* Thin gold sheen along top edge — matches website account sidebar */}
          <span
            className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent"
            aria-hidden
          />
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-navy text-sm font-bold shrink-0 shadow-[0_4px_12px_-4px_rgb(200_162_75/0.5)]">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-snug">
              {user.fullName}
            </p>
            <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-brand-300 ring-1 ring-white/15">
              {ROLE_LABEL[user.role]}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
        {resolved.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-text-muted/60">
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

      {/* Logout footer — minimal, user context already shown above */}
      <div className="border-t border-sidebar-border/30 px-3 py-3 shrink-0">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12px] font-medium text-sidebar-text-muted hover:text-white hover:bg-sidebar-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
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
        boxShadow: '-12px 0 32px -16px rgb(15 30 51 / 0.20)',
      }}
    >
      <div className="sticky top-0 h-screen w-full">
        <SidebarContent user={user} sections={sections} />
      </div>
    </aside>
  );
}
