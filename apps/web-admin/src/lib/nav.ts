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
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';
import type { SessionRole } from './session';

/**
 * Serializable icon registry. Nav data carries a string `iconKey` (not a
 * component) so nav sections can be passed as props from Server Components to
 * Client Components (e.g. MobileNav) without tripping React's "Functions
 * cannot be passed directly to Client Components" error. The render component
 * maps the key back to the Lucide component via this registry.
 */
export const NAV_ICONS = {
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
  MessageSquareText,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof NAV_ICONS;

export interface NavItem {
  href: string;
  label: string;
  iconKey: IconKey;
  admin?: boolean;
  /** Visible only to sales actors (SALES + SALES_MANAGER), never ADMIN. Used for
   *  personal self-view pages (e.g. own compensation) that are redundant for
   *  ADMIN — a SALES_MANAGER is a sales actor, so it sees these too. */
  salesActorOnly?: boolean;
  /** When set on an `admin` item, also surface it to SALES_MANAGER (manager
   *  team-view pages that are otherwise admin-managed). Has no effect unless
   *  `admin` is also true. */
  manager?: boolean;
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
      { href: '/dashboard', label: 'لوحة التحكم', iconKey: 'LayoutDashboard' },
    ],
  },
  {
    title: 'المبيعات',
    items: [
      { href: '/dashboard/projects', label: 'المشاريع', iconKey: 'Building2' },
      { href: '/dashboard/inventory', label: 'المخزون', iconKey: 'Boxes' },
      { href: '/dashboard/units', label: 'الوحدات', iconKey: 'Home' },
      { href: '/dashboard/leads', label: 'فرص المبيعات (CRM)', iconKey: 'Users' },
      // P13 — general info/contact-form inquiries (Guest/Client/Customer).
      // Role-only gate matches GET /info-requests (ADMIN + SALES + SALES_MANAGER).
      { href: '/dashboard/requests', label: 'استفسارات العملاء', iconKey: 'MessageSquareText' },
      // Clients/customers read from the ADMIN-only /users API, so they would
      // 403 for SALES — hidden from the SALES sidebar until a scoped endpoint
      // exists. SALES works customer data through the CRM (leads) instead.
      { href: '/dashboard/clients', label: 'المتصفّحون', iconKey: 'UserSquare2', admin: true },
      { href: '/dashboard/customers', label: 'العملاء', iconKey: 'UserCheck', admin: true },
      { href: '/dashboard/visits', label: 'الزيارات', iconKey: 'CalendarClock' },
      { href: '/dashboard/reservations', label: 'الحجوزات', iconKey: 'BookmarkCheck' },
      { href: '/dashboard/contracts', label: 'العقود', iconKey: 'FileText' },
    ],
  },
  {
    title: 'العمليات',
    items: [
      { href: '/dashboard/installments', label: 'خطط التقسيط', iconKey: 'Wallet' },
      { href: '/dashboard/deposits', label: 'الدفعات', iconKey: 'Receipt', admin: true },
      { href: '/dashboard/maintenance', label: 'الصيانة', iconKey: 'Wrench', admin: true },
      { href: '/dashboard/bonus', label: 'العمولات', iconKey: 'BadgePercent', admin: true },
      { href: '/dashboard/targets', label: 'أهداف وأداء المبيعات', iconKey: 'Gauge', admin: true, manager: true },
      { href: '/dashboard/my-compensation', label: 'مستحقاتي وأهدافي', iconKey: 'Wallet', salesActorOnly: true },
    ],
  },
  {
    title: 'الوسطاء',
    items: [
      { href: '/dashboard/brokers', label: 'الوسطاء', iconKey: 'Briefcase', admin: true },
      { href: '/dashboard/broker-leads', label: 'فرص من الوسطاء', iconKey: 'Users', admin: true },
      { href: '/dashboard/broker-reservations', label: 'حجوزات من الوسطاء', iconKey: 'BookmarkCheck', admin: true },
      { href: '/dashboard/broker-contracts', label: 'عقود من الوسطاء', iconKey: 'FileText', admin: true },
      { href: '/dashboard/broker-commissions', label: 'عمولات الوسطاء', iconKey: 'BadgePercent', admin: true },
      { href: '/dashboard/broker-payouts', label: 'مدفوعات الوسطاء', iconKey: 'Wallet', admin: true },
      { href: '/dashboard/broker-reports', label: 'تقارير الوسطاء', iconKey: 'BarChart3', admin: true },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { href: '/dashboard/cms', label: 'المحتوى', iconKey: 'FileEdit', admin: true },
      { href: '/dashboard/documents', label: 'المستندات', iconKey: 'Files', admin: true },
      { href: '/dashboard/notifications', label: 'الإشعارات', iconKey: 'Bell', admin: true },
      { href: '/dashboard/reports', label: 'التقارير', iconKey: 'BarChart3', admin: true },
      { href: '/dashboard/users', label: 'المستخدمون', iconKey: 'ShieldCheck', admin: true },
      { href: '/dashboard/permissions', label: 'الصلاحيات', iconKey: 'ShieldCheck', admin: true },
      { href: '/dashboard/operations', label: 'مركز العمليات', iconKey: 'Gauge', admin: true },
      { href: '/dashboard/audit-logs', label: 'سجلات التدقيق', iconKey: 'ScrollText', admin: true },
      { href: '/dashboard/settings', label: 'الإعدادات', iconKey: 'Settings', admin: true },
    ],
  },
];

export function filterNavForRole(role: SessionRole): NavSection[] {
  // Brokers don't use the admin nav at all — see BROKER_NAV_SECTIONS below.
  if (role === 'BROKER') return [];
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.admin) {
        return role === 'ADMIN' || (item.manager === true && role === 'SALES_MANAGER');
      }
      if (item.salesActorOnly) return role === 'SALES' || role === 'SALES_MANAGER';
      return true;
    }),
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
      { href: '/portal', label: 'لوحة التحكم', iconKey: 'LayoutDashboard' },
      { href: '/portal/performance', label: 'الأداء', iconKey: 'BarChart3' },
      { href: '/portal/projects', label: 'المشاريع', iconKey: 'Building2' },
      { href: '/portal/units', label: 'الوحدات', iconKey: 'Home' },
      { href: '/portal/leads', label: 'الفرص', iconKey: 'Users' },
      { href: '/portal/visits', label: 'الزيارات', iconKey: 'CalendarClock' },
      { href: '/portal/reservations', label: 'الحجوزات', iconKey: 'BookmarkCheck' },
      { href: '/portal/contracts', label: 'العقود', iconKey: 'FileText' },
      { href: '/portal/commissions', label: 'العمولات', iconKey: 'BadgePercent' },
      { href: '/portal/payouts', label: 'المدفوعات', iconKey: 'Wallet' },
      { href: '/portal/activity', label: 'النشاط', iconKey: 'Activity' },
      { href: '/portal/notifications', label: 'الإشعارات', iconKey: 'Bell' },
      { href: '/portal/team', label: 'فريق العمل', iconKey: 'Users' },
      { href: '/portal/profile', label: 'الملف الشخصي', iconKey: 'UserCircle' },
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
