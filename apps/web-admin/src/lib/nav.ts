import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserCheck,
  UserSquare2,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Wallet,
  Receipt,
  Wrench,
  BadgePercent,
  Briefcase,
  FileEdit,
  Bell,
  BarChart3,
  Boxes,
  ShieldCheck,
  ScrollText,
  Settings,
  UserCircle,
  Activity,
  Gauge,
  Files,
  type LucideIcon,
} from 'lucide-react';
import type { SessionRole } from './session';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Grouped sidebar navigation. Hrefs and labels match the original flat NAV
 * in dashboard/layout.tsx — no items removed, no labels changed.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'نظرة عامة',
    items: [
      { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    ],
  },
  {
    title: 'المبيعات',
    items: [
      { href: '/dashboard/projects', label: 'المشاريع', icon: Building2 },
      { href: '/dashboard/inventory', label: 'المخزون', icon: Boxes },
      { href: '/dashboard/units', label: 'الوحدات', icon: Home },
      { href: '/dashboard/leads', label: 'فرص المبيعات (CRM)', icon: Users },
      { href: '/dashboard/clients', label: 'المتصفّحون', icon: UserSquare2 },
      { href: '/dashboard/customers', label: 'العملاء', icon: UserCheck },
      { href: '/dashboard/visits', label: 'الزيارات', icon: CalendarClock },
      { href: '/dashboard/reservations', label: 'الحجوزات', icon: BookmarkCheck },
      { href: '/dashboard/contracts', label: 'العقود', icon: FileText },
    ],
  },
  {
    title: 'العمليات',
    items: [
      { href: '/dashboard/installments', label: 'خطط التقسيط', icon: Wallet },
      { href: '/dashboard/deposits', label: 'الدفعات', icon: Receipt, admin: true },
      { href: '/dashboard/maintenance', label: 'الصيانة', icon: Wrench, admin: true },
      { href: '/dashboard/bonus', label: 'العمولات', icon: BadgePercent, admin: true },
    ],
  },
  {
    title: 'الوسطاء',
    items: [
      { href: '/dashboard/brokers', label: 'الوسطاء', icon: Briefcase, admin: true },
      { href: '/dashboard/broker-leads', label: 'فرص من الوسطاء', icon: Users, admin: true },
      { href: '/dashboard/broker-reservations', label: 'حجوزات من الوسطاء', icon: BookmarkCheck, admin: true },
      { href: '/dashboard/broker-contracts', label: 'عقود من الوسطاء', icon: FileText, admin: true },
      { href: '/dashboard/broker-commissions', label: 'عمولات الوسطاء', icon: BadgePercent, admin: true },
      { href: '/dashboard/broker-payouts', label: 'مدفوعات الوسطاء', icon: Wallet, admin: true },
      { href: '/dashboard/broker-reports', label: 'تقارير الوسطاء', icon: BarChart3, admin: true },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { href: '/dashboard/cms', label: 'المحتوى', icon: FileEdit, admin: true },
      { href: '/dashboard/documents', label: 'المستندات', icon: Files, admin: true },
      { href: '/dashboard/notifications', label: 'الإشعارات', icon: Bell, admin: true },
      { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3, admin: true },
      { href: '/dashboard/users', label: 'المستخدمون', icon: ShieldCheck, admin: true },
      { href: '/dashboard/permissions', label: 'الصلاحيات', icon: ShieldCheck, admin: true },
      { href: '/dashboard/operations', label: 'مركز العمليات', icon: Gauge, admin: true },
      { href: '/dashboard/audit-logs', label: 'سجلات التدقيق', icon: ScrollText, admin: true },
      { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings, admin: true },
    ],
  },
];

export function filterNavForRole(role: SessionRole): NavSection[] {
  // Brokers don't use the admin nav at all — see BROKER_NAV_SECTIONS below.
  if (role === 'BROKER') return [];
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.admin || role === 'ADMIN'),
  })).filter((section) => section.items.length > 0);
}

/**
 * Dedicated nav for the broker portal at /portal/*. Kept separate from the
 * admin NAV_SECTIONS so the two surfaces evolve independently.
 */
export const BROKER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'البوابة',
    items: [
      { href: '/portal', label: 'لوحة التحكم', icon: LayoutDashboard },
      { href: '/portal/performance', label: 'الأداء', icon: BarChart3 },
      { href: '/portal/projects', label: 'المشاريع', icon: Building2 },
      { href: '/portal/units', label: 'الوحدات', icon: Home },
      { href: '/portal/leads', label: 'الفرص', icon: Users },
      { href: '/portal/visits', label: 'الزيارات', icon: CalendarClock },
      { href: '/portal/reservations', label: 'الحجوزات', icon: BookmarkCheck },
      { href: '/portal/contracts', label: 'العقود', icon: FileText },
      { href: '/portal/commissions', label: 'العمولات', icon: BadgePercent },
      { href: '/portal/payouts', label: 'المدفوعات', icon: Wallet },
      { href: '/portal/activity', label: 'النشاط', icon: Activity },
      { href: '/portal/notifications', label: 'الإشعارات', icon: Bell },
      { href: '/portal/team', label: 'فريق العمل', icon: Users },
      { href: '/portal/profile', label: 'الملف الشخصي', icon: UserCircle },
    ],
  },
];

/**
 * Filter the broker portal nav based on per-user flags. Items the user can't
 * use are hidden so the sidebar doesn't dangle dead links — the backend
 * also enforces these (BrokerManagerGuard / BrokerCommissionsViewerGuard).
 */
export function filterBrokerNavForFlags(flags: {
  canManageBrokerUsers: boolean;
  isPrimaryContact: boolean;
  canViewCommissions: boolean;
}): NavSection[] {
  const canManageTeam = flags.isPrimaryContact || flags.canManageBrokerUsers;
  return BROKER_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.href === '/portal/team') return canManageTeam;
      if (item.href === '/portal/commissions' || item.href === '/portal/payouts') {
        return flags.canViewCommissions;
      }
      return true;
    }),
  })).filter((s) => s.items.length > 0);
}

export function findNavItem(pathname: string): NavItem | undefined {
  // Prefer exact match; fall back to prefix match for nested routes (/dashboard/units/123).
  const all = [...NAV_SECTIONS, ...BROKER_NAV_SECTIONS].flatMap((s) => s.items);
  const exact = all.find((i) => i.href === pathname);
  if (exact) return exact;
  // Skip the workspace roots from prefix matching to avoid claiming all routes.
  return all
    .filter((i) => i.href !== '/dashboard' && i.href !== '/portal')
    .find((i) => pathname.startsWith(i.href + '/') || pathname === i.href);
}
