import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserCheck,
  UserSquare2,
  CalendarClock,
  CalendarDays,
  BookmarkCheck,
  FileText,
  Globe,
  Printer,
  ListPlus,
  Sparkles,
  Wallet,
  Receipt,
  Landmark,
  Wrench,
  BadgePercent,
  Briefcase,
  FileEdit,
  Bell,
  PhoneCall,
  TrendingDown,
  Megaphone,
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
  Target,
  Tag,
  Palette,
  HardDriveDownload,
  Upload,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import type { SessionRole } from './session';
import type { NavItemKey, NavSectionKey } from '@/messages/ui';

/**
 * Serializable icon registry. Nav data carries a string `iconKey` (not a
 * component) so nav sections can be passed as props from Server Components to
 * Client Components (e.g. MobileNav) without tripping React's "Functions
 * cannot be passed directly to Client Components" error. The render component
 * maps the key back to the Lucide component via this registry.
 */
export const NAV_ICONS = {
  Globe,
  Printer,
  ListPlus,
  Sparkles,
  Tag,
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
  Landmark,
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
  Target,
  Palette,
  HardDriveDownload,
  Upload,
  Scale,
  PhoneCall,
  TrendingDown,
  Megaphone,
  CalendarDays,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof NAV_ICONS;

export interface NavItem {
  href: string;
  label: string;
  /** Key into messages/ui.ts nav.items for EN/AR localization. */
  labelKey: NavItemKey;
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
  /** PRM: permission codes that also open the page to a staff member the
   *  role flags above leave out (any one of them is enough). */
  perm?: string[];
  /** Plan feature the page needs (CapabilityService key). Hidden when the
   *  company's plan switches it off — the API would refuse the page. */
  feature?: string;
  /** A count shown beside the label (set per request, e.g. proofs waiting). */
  badge?: number;
  /** Other pages this link stands for (the settings page's): active on them too. */
  matches?: string[];
}

export interface NavSection {
  title: string;
  /** Key into messages/ui.ts nav.sections for EN/AR localization. */
  titleKey: NavSectionKey;
  /** Shown as plain links, not a section to open and close. */
  flat?: boolean;
  items: NavItem[];
}

/**
 * Grouped sidebar navigation. Hrefs and labels match the original flat NAV
 * in dashboard/layout.tsx — no items removed, no labels changed.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'الرئيسية',
    titleKey: 'home',
    items: [
      { href: '/dashboard', label: 'لوحة التحكم', labelKey: 'dashboard', iconKey: 'LayoutDashboard' },
      { href: '/dashboard/assistant', label: 'المساعد الذكي', labelKey: 'aiAssistant', iconKey: 'Sparkles' },
      { href: '/dashboard/operations', label: 'مركز العمليات', labelKey: 'operations', iconKey: 'Gauge', admin: true },
    ],
  },
  {
    title: 'المبيعات',
    titleKey: 'sales',
    items: [
      { href: '/dashboard/leads', label: 'فرص المبيعات (CRM)', labelKey: 'leads', iconKey: 'Users' },
      { href: '/dashboard/follow-ups', label: 'المتابعات', labelKey: 'followUps', iconKey: 'PhoneCall' },
      { href: '/dashboard/calendar', label: 'التقويم', labelKey: 'calendar', iconKey: 'CalendarDays' },
      { href: '/dashboard/visits', label: 'الزيارات', labelKey: 'visits', iconKey: 'CalendarClock' },
      { href: '/dashboard/reservations', label: 'الحجوزات', labelKey: 'reservations', iconKey: 'BookmarkCheck' },
      { href: '/dashboard/contracts', label: 'العقود', labelKey: 'contracts', iconKey: 'FileText' },
      // P13 — general info/contact-form inquiries (Guest/Client/Customer).
      // Role-only gate matches GET /info-requests (ADMIN + SALES + SALES_MANAGER).
      { href: '/dashboard/requests', label: 'استفسارات العملاء', labelKey: 'requests', iconKey: 'MessageSquareText' },
    ],
  },
  {
    title: 'العملاء',
    titleKey: 'customers',
    items: [
      // Clients/customers read from the ADMIN-only /users API, so they would
      // 403 for SALES — hidden from the SALES sidebar until a scoped endpoint
      // exists. SALES works customer data through the CRM (leads) instead.
      { href: '/dashboard/customers', label: 'العملاء', labelKey: 'customers', iconKey: 'UserCheck', admin: true },
      { href: '/dashboard/clients', label: 'المتصفّحون', labelKey: 'clients', iconKey: 'UserSquare2', admin: true },
      { href: '/dashboard/maintenance', label: 'الصيانة', labelKey: 'maintenance', iconKey: 'Wrench', admin: true, perm: ['maintenance:manage:all'], feature: 'feature.maintenance' },
      { href: '/dashboard/documents', label: 'المستندات', labelKey: 'documents', iconKey: 'Files', admin: true },
    ],
  },
  {
    title: 'المشاريع والوحدات',
    titleKey: 'inventory',
    items: [
      { href: '/dashboard/projects', label: 'المشاريع', labelKey: 'projects', iconKey: 'Building2' },
      { href: '/dashboard/inventory', label: 'المخزون', labelKey: 'inventory', iconKey: 'Boxes' },
      { href: '/dashboard/units', label: 'الوحدات', labelKey: 'units', iconKey: 'Home' },
    ],
  },
  {
    title: 'المالية',
    titleKey: 'finance',
    items: [
      { href: '/dashboard/installments', label: 'خطط التقسيط', labelKey: 'installments', iconKey: 'Wallet' },
      // The whole company's payments (GET /deposits/:id: ADMIN, or deposits:read:all).
      { href: '/dashboard/deposits', label: 'الدفعات', labelKey: 'deposits', iconKey: 'Receipt', admin: true, perm: ['deposits:read:all'] },
      // Customers' payment proofs waiting for an admin (approve / reject).
      { href: '/dashboard/payments/review', label: 'إيصالات الدفع', labelKey: 'paymentProofs', iconKey: 'Receipt', admin: true },
      // FG-01 — GET /payment-instruments is ADMIN + SALES_MANAGER.
      { href: '/dashboard/cheques', label: 'الشيكات', labelKey: 'cheques', iconKey: 'Landmark', admin: true, manager: true, perm: ['payment-instruments:manage'] },
      // Receivables and payables (GET /reports/ledger: ADMIN, or reports:financial:read).
      { href: '/dashboard/ledger', label: 'المستحقات والالتزامات', labelKey: 'ledger', iconKey: 'Scale', admin: true, perm: ['reports:financial:read'] },
    ],
  },
  {
    title: 'الفريق والأداء',
    titleKey: 'team',
    items: [
      { href: '/dashboard/sales/performance', label: 'أداء فريق المبيعات', labelKey: 'salesPerformance', iconKey: 'Target', admin: true, manager: true },
      { href: '/dashboard/targets', label: 'إدارة أهداف المبيعات', labelKey: 'targets', iconKey: 'Gauge', admin: true, manager: true },
      { href: '/dashboard/bonus', label: 'العمولات', labelKey: 'bonus', iconKey: 'BadgePercent', admin: true, perm: ['bonus:entries:read:all', 'bonus:rules:manage', 'bonus:entries:create'] },
      { href: '/dashboard/my-compensation', label: 'مستحقاتي وأهدافي', labelKey: 'myCompensation', iconKey: 'Wallet', salesActorOnly: true },
    ],
  },
  {
    title: 'الوسطاء',
    titleKey: 'brokers',
    items: [
      { href: '/dashboard/brokers', label: 'الوسطاء', labelKey: 'brokers', iconKey: 'Briefcase', admin: true, perm: ['brokers:read'], feature: 'feature.brokers' },
      { href: '/dashboard/broker-leads', label: 'فرص من الوسطاء', labelKey: 'brokerLeads', iconKey: 'Users', admin: true, feature: 'feature.brokers' },
      { href: '/dashboard/broker-reservations', label: 'حجوزات من الوسطاء', labelKey: 'brokerReservations', iconKey: 'BookmarkCheck', admin: true, feature: 'feature.brokers' },
      { href: '/dashboard/broker-contracts', label: 'عقود من الوسطاء', labelKey: 'brokerContracts', iconKey: 'FileText', admin: true, feature: 'feature.brokers' },
      { href: '/dashboard/broker-commissions', label: 'عمولات الوسطاء', labelKey: 'brokerCommissions', iconKey: 'BadgePercent', admin: true, perm: ['broker_commissions:read'], feature: 'feature.brokers' },
      { href: '/dashboard/broker-payouts', label: 'مدفوعات الوسطاء', labelKey: 'brokerPayouts', iconKey: 'Wallet', admin: true, perm: ['broker_payouts:read'], feature: 'feature.brokers' },
      { href: '/dashboard/broker-reports', label: 'تقارير الوسطاء', labelKey: 'brokerReports', iconKey: 'BarChart3', admin: true, perm: ['broker_reports:read'], feature: 'feature.brokers' },
    ],
  },
  {
    title: 'التسويق والموقع',
    titleKey: 'marketing',
    items: [
      { href: '/dashboard/campaigns', label: 'الحملات التسويقية', labelKey: 'campaigns', iconKey: 'Megaphone', admin: true, manager: true, perm: ['campaigns:manage'] },
      { href: '/dashboard/lost-reasons', label: 'أسباب الخسارة', labelKey: 'lostReasons', iconKey: 'TrendingDown', admin: true, manager: true, perm: ['lead_sources:manage'] },
      { href: '/dashboard/cms', label: 'المحتوى', labelKey: 'cms', iconKey: 'FileEdit', admin: true, perm: ['cms:pages:manage', 'cms:banners:manage', 'cms:articles:manage'] },
      { href: '/dashboard/notifications', label: 'الإشعارات', labelKey: 'notifications', iconKey: 'Bell', admin: true, perm: ['notifications:send', 'notifications:templates:manage'] },
    ],
  },
  {
    title: 'أخرى',
    titleKey: 'more',
    /** Shown as plain links, not a section to open: reports and the settings page. */
    flat: true,
    items: [
      { href: '/dashboard/reports', label: 'التقارير', labelKey: 'reports', iconKey: 'BarChart3', admin: true, perm: ['reports:sales:read', 'reports:operational:read', 'reports:financial:read'] },
    ],
  },
];

/**
 * «الإعدادات»: the company's set-up pages, gathered on one page
 * (/dashboard/setup) instead of a long run of sidebar links. All are
 * ADMIN-only today, so the settings link shows to admins only.
 */
export const SETTINGS_HUB: { group: 'people' | 'company' | 'data' | 'system'; items: NavItem[] }[] = [
  {
    group: 'people',
    items: [
      { href: '/dashboard/users', label: 'المستخدمون', labelKey: 'users', iconKey: 'ShieldCheck', admin: true },
      { href: '/dashboard/permissions', label: 'الصلاحيات', labelKey: 'permissions', iconKey: 'ShieldCheck', admin: true },
      { href: '/dashboard/audit-logs', label: 'سجلات التدقيق', labelKey: 'auditLogs', iconKey: 'ScrollText', admin: true },
    ],
  },
  {
    group: 'company',
    items: [
      { href: '/dashboard/company/branding', label: 'الهوية البصرية', labelKey: 'branding', iconKey: 'Palette', admin: true },
      { href: '/dashboard/company/print', label: 'الطباعة والمستندات', labelKey: 'printing', iconKey: 'Printer', admin: true },
      { href: '/dashboard/company/customer-fields', label: 'خانات العميل الإضافية', labelKey: 'customerFields', iconKey: 'ListPlus', admin: true },
    ],
  },
  {
    group: 'data',
    items: [
      { href: '/dashboard/data-export', label: 'تصدير البيانات', labelKey: 'dataExport', iconKey: 'HardDriveDownload', admin: true },
      { href: '/dashboard/data-import', label: 'استيراد البيانات', labelKey: 'dataImport', iconKey: 'Upload', admin: true },
    ],
  },
  {
    group: 'system',
    items: [
      { href: '/dashboard/settings', label: 'الإعدادات', labelKey: 'generalSettings', iconKey: 'Settings', admin: true },
    ],
  },
];

/** The sidebar's link to the settings page; active on any page it gathers. */
const SETTINGS_HUB_ITEM: NavItem = {
  href: '/dashboard/setup',
  label: 'الإعدادات',
  labelKey: 'settings',
  iconKey: 'Settings',
  matches: SETTINGS_HUB.flatMap((g) => g.items.map((i) => i.href)),
};

export const SUPER_ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'المنصة',
    titleKey: 'platform',
    items: [
      { href: '/dashboard/super-admin', label: 'لوحة التحكم', labelKey: 'dashboard', iconKey: 'LayoutDashboard' },
      { href: '/dashboard/super-admin/companies', label: 'الشركات', labelKey: 'companies', iconKey: 'Globe' },
      { href: '/dashboard/super-admin/pricing', label: 'باقات الأسعار', labelKey: 'reports', iconKey: 'Tag' },
      { href: '/dashboard/super-admin/ai', label: 'المساعد الذكي', labelKey: 'aiAssistant', iconKey: 'Sparkles' },
    ],
  },
];

export function filterNavForRole(
  role: SessionRole,
  disabledFeatures: ReadonlySet<string> = new Set(),
  codes: ReadonlySet<string> = new Set(),
): NavSection[] {
  if (role === 'SUPER_ADMIN') return SUPER_ADMIN_NAV_SECTIONS;
  // Brokers don't use the admin nav at all — see BROKER_NAV_SECTIONS below.
  if (role === 'BROKER') return [];
  const visible = navItemVisible(role, disabledFeatures, codes);
  const hub = filterSettingsHub(role, disabledFeatures, codes);
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: [
      ...section.items.filter(visible),
      // The settings page closes the last section, when it has a page for this user.
      ...(section.titleKey === 'more' && hub.length > 0 ? [SETTINGS_HUB_ITEM] : []),
    ],
  })).filter((section) => section.items.length > 0);
}

/** The settings page's groups, with only the pages this user may open. */
export function filterSettingsHub(
  role: SessionRole,
  disabledFeatures: ReadonlySet<string> = new Set(),
  codes: ReadonlySet<string> = new Set(),
) {
  if (role === 'SUPER_ADMIN' || role === 'BROKER') return [];
  const visible = navItemVisible(role, disabledFeatures, codes);
  return SETTINGS_HUB.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0);
}

function navItemVisible(role: SessionRole, disabledFeatures: ReadonlySet<string>, codes: ReadonlySet<string>) {
  return (item: NavItem): boolean => {
    if (item.feature && disabledFeatures.has(item.feature)) return false;
    if (item.perm?.some((c) => codes.has(c))) return true;
    if (item.admin) {
      return role === 'ADMIN' || (item.manager === true && role === 'SALES_MANAGER');
    }
    if (item.salesActorOnly) return role === 'SALES' || role === 'SALES_MANAGER';
    return true;
  };
}

/**
 * Dedicated nav for the broker portal at /portal/*. Kept separate from the
 * admin NAV_SECTIONS so the two surfaces evolve independently.
 */
export const BROKER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'البوابة',
    titleKey: 'portal',
    items: [
      { href: '/portal', label: 'لوحة التحكم', labelKey: 'dashboard', iconKey: 'LayoutDashboard' },
      { href: '/portal/performance', label: 'الأداء', labelKey: 'performance', iconKey: 'BarChart3' },
      { href: '/portal/projects', label: 'المشاريع', labelKey: 'projects', iconKey: 'Building2' },
      { href: '/portal/units', label: 'الوحدات', labelKey: 'units', iconKey: 'Home' },
      { href: '/portal/leads', label: 'الفرص', labelKey: 'leads', iconKey: 'Users' },
      { href: '/portal/visits', label: 'الزيارات', labelKey: 'visits', iconKey: 'CalendarClock' },
      { href: '/portal/reservations', label: 'الحجوزات', labelKey: 'reservations', iconKey: 'BookmarkCheck' },
      { href: '/portal/contracts', label: 'العقود', labelKey: 'contracts', iconKey: 'FileText' },
      { href: '/portal/commissions', label: 'العمولات', labelKey: 'commissions', iconKey: 'BadgePercent' },
      { href: '/portal/payouts', label: 'المدفوعات', labelKey: 'payouts', iconKey: 'Wallet' },
      { href: '/portal/activity', label: 'النشاط', labelKey: 'activity', iconKey: 'Activity' },
      { href: '/portal/notifications', label: 'الإشعارات', labelKey: 'notifications', iconKey: 'Bell' },
      { href: '/portal/team', label: 'فريق العمل', labelKey: 'team', iconKey: 'Users' },
      { href: '/portal/profile', label: 'الملف الشخصي', labelKey: 'profile', iconKey: 'UserCircle' },
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
