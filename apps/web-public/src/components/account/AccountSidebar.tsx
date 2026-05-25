'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  UserCircle2,
  Heart,
  CalendarClock,
  MessageSquareText,
  Building2,
  FileText,
  Wallet,
  Wrench,
  Bell,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { logoutAction } from '@/lib/auth-actions';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
}

const CLIENT_ITEMS: NavItem[] = [
  { href: routes.account, label: 'لوحة الحساب', icon: LayoutGrid },
  { href: routes.accountProfile, label: 'الملف الشخصي', icon: UserCircle2 },
  { href: routes.accountFavorites, label: 'المفضلة', icon: Heart },
  { href: routes.accountVisits, label: 'الزيارات', icon: CalendarClock },
  { href: routes.accountRequests, label: 'الطلبات', icon: MessageSquareText },
];

// Post-purchase sections — shown only to CUSTOMER.
const CUSTOMER_ITEMS: NavItem[] = [
  { href: routes.accountProperty, label: 'عقاراتي', icon: Building2 },
  { href: routes.accountContracts, label: 'العقود', icon: FileText },
  { href: routes.accountDeposits, label: 'الدفعات', icon: Wallet },
  { href: routes.accountMaintenance, label: 'الصيانة', icon: Wrench },
  { href: routes.accountNotifications, label: 'الإشعارات', icon: Bell },
];

function isActive(pathname: string, href: string): boolean {
  return href === routes.account ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Persistent account sidebar: profile summary + vertical nav + logout. On
 * desktop it sticks beside the content; on mobile it collapses to a profile
 * row above a horizontally-scrolling nav. CUSTOMER users additionally see a
 * post-purchase group; CLIENT users never see those links.
 */
export function AccountSidebar({
  fullName,
  roleLabel,
  isCustomer = false,
}: {
  fullName?: string;
  roleLabel: string;
  isCustomer?: boolean;
}) {
  const pathname = usePathname();

  const renderItem = ({ href, label, icon: Icon }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href as Route}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 lg:w-full',
          active ? 'bg-navy text-white shadow-soft' : 'text-ink-muted hover:bg-navy/[0.05] hover:text-ink-strong',
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-gold-300' : 'text-gold-500')} aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-2xl border border-hairline bg-surface p-4 shadow-card sm:p-5">
        {/* Profile */}
        <div className="flex items-center gap-3 border-b border-hairline pb-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
            <UserCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink-strong">{fullName || 'حسابك'}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-600">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Nav — horizontal scroll on mobile, vertical on desktop */}
        <nav className="mt-4 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {CLIENT_ITEMS.map(renderItem)}

          {isCustomer && (
            <>
              {/* Group separator: vertical line on mobile, full divider + label on desktop */}
              <span
                className="my-auto h-6 w-px shrink-0 bg-hairline lg:my-2 lg:h-px lg:w-full"
                aria-hidden
              />
              <span className="hidden px-3.5 pb-1 text-[11px] font-medium text-ink-muted/70 lg:block">
                خدمات العميل
              </span>
              {CUSTOMER_ITEMS.map(renderItem)}
            </>
          )}

          {/* Logout — divided off on desktop, inline at the end on mobile */}
          <form action={logoutAction} className="ms-auto shrink-0 lg:ms-0 lg:mt-1 lg:w-full lg:border-t lg:border-hairline lg:pt-1">
            <button
              type="submit"
              className="inline-flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-error/5 hover:text-error"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
              تسجيل الخروج
            </button>
          </form>
        </nav>
      </div>
    </aside>
  );
}
