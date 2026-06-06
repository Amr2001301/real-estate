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
      <div className="px-5 h-[72px] flex items-center border-b border-sidebar-border shrink-0">
        <Brand theme="dark" />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-5 space-y-6">
        {resolved.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-text-muted">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.iconKey];
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 text-xs font-bold ring-1 ring-inset ring-brand-500/20 shrink-0">
            {initials(user.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">
              {user.fullName}
            </p>
            <p className="text-[11px] text-sidebar-text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text-muted hover:text-white hover:bg-sidebar-bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ user, sections, className }: Omit<Props, 'onNavigate'>) {
  return (
    <aside
      className={`hidden lg:flex w-[264px] shrink-0 relative z-20 ${className ?? ''}`}
      style={{
        // Soft elevation toward the content side (end edge in RTL = visual left)
        boxShadow: '-12px 0 32px -16px rgb(15 30 51 / 0.20)',
      }}
    >
      <div className="sticky top-0 h-screen w-full">
        <SidebarContent user={user} sections={sections} />
      </div>
    </aside>
  );
}
