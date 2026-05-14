import {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  UserSquare2,
  CalendarClock,
  BookmarkCheck,
  FileText,
  Wallet,
  Receipt,
  Wrench,
  BadgePercent,
  FileEdit,
  Bell,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

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
      { href: '/dashboard/units', label: 'الوحدات', icon: Home },
      { href: '/dashboard/leads', label: 'فرص المبيعات (CRM)', icon: Users },
      { href: '/dashboard/clients', label: 'العملاء', icon: UserSquare2 },
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
    title: 'الإدارة',
    items: [
      { href: '/dashboard/cms', label: 'المحتوى', icon: FileEdit, admin: true },
      { href: '/dashboard/notifications', label: 'الإشعارات', icon: Bell, admin: true },
      { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3, admin: true },
      { href: '/dashboard/users', label: 'المستخدمون', icon: ShieldCheck, admin: true },
      { href: '/dashboard/audit', label: 'سجل التدقيق', icon: ScrollText, admin: true },
      { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings, admin: true },
    ],
  },
];

export function filterNavForRole(role: 'ADMIN' | 'SALES'): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.admin || role === 'ADMIN'),
  })).filter((section) => section.items.length > 0);
}

export function findNavItem(pathname: string): NavItem | undefined {
  // Prefer exact match; fall back to prefix match for nested routes (/dashboard/units/123).
  const all = NAV_SECTIONS.flatMap((s) => s.items);
  const exact = all.find((i) => i.href === pathname);
  if (exact) return exact;
  // Skip the root /dashboard from prefix matching to avoid claiming all routes.
  return all
    .filter((i) => i.href !== '/dashboard')
    .find((i) => pathname.startsWith(i.href + '/') || pathname === i.href);
}
