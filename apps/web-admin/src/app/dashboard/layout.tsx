import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { logoutAction } from '@/app/login/actions';

const NAV: Array<{ href: string; label: string; admin?: boolean }> = [
  { href: '/dashboard', label: 'لوحة التحكم' },
  { href: '/dashboard/projects', label: 'المشاريع' },
  { href: '/dashboard/units', label: 'الوحدات' },
  { href: '/dashboard/leads', label: 'العملاء المحتملون (CRM)' },
  { href: '/dashboard/clients', label: 'العملاء' },
  { href: '/dashboard/visits', label: 'الزيارات' },
  { href: '/dashboard/reservations', label: 'الحجوزات' },
  { href: '/dashboard/contracts', label: 'العقود' },
  { href: '/dashboard/installments', label: 'خطط التقسيط', admin: true },
  { href: '/dashboard/deposits', label: 'الدفعات', admin: true },
  { href: '/dashboard/maintenance', label: 'الصيانة', admin: true },
  { href: '/dashboard/bonus', label: 'العمولات', admin: true },
  { href: '/dashboard/cms', label: 'المحتوى', admin: true },
  { href: '/dashboard/notifications', label: 'الإشعارات', admin: true },
  { href: '/dashboard/reports', label: 'التقارير', admin: true },
  { href: '/dashboard/users', label: 'المستخدمون', admin: true },
  { href: '/dashboard/audit', label: 'سجل التدقيق', admin: true },
  { href: '/dashboard/settings', label: 'الإعدادات', admin: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const items = NAV.filter((n) => !n.admin || user.role === 'ADMIN');

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-l border-gray-200 sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-brand-700">منصة العقارات</h2>
          <p className="text-xs text-gray-500 mt-1">{user.fullName} · {user.role}</p>
        </div>
        <nav className="p-2 space-y-1 text-sm">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className="block rounded-lg px-3 py-2 hover:bg-gray-100 text-gray-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="p-4">
          <button
            type="submit"
            className="w-full text-sm text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
