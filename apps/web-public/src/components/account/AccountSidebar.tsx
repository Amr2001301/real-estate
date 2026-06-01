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
  BookmarkCheck,
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
  // P7 — reservations are visible to BOTH CLIENT and CUSTOMER. Creating a
  // reservation alone does NOT promote CLIENT → CUSTOMER; only contract
  // creation/conversion does (see PROMOTION RULE in
  // apps/api/src/modules/contracts/contracts.module.ts and
  // reservations.module.ts).
  { href: routes.accountReservations, label: 'الحجوزات', icon: BookmarkCheck },
  // P5 — notifications are now reachable by every portal role (CLIENT +
  // CUSTOMER). The page used to live in the (customer) route group and was
  // unreachable to CLIENT.
  { href: routes.accountNotifications, label: 'الإشعارات', icon: Bell },
];

// Post-purchase sections — shown only to CUSTOMER.
const CUSTOMER_ITEMS: NavItem[] = [
  { href: routes.accountProperty, label: 'عقاراتي', icon: Building2 },
  { href: routes.accountContracts, label: 'العقود', icon: FileText },
  { href: routes.accountInstallments, label: 'الأقساط', icon: CalendarClock },
  { href: routes.accountDeposits, label: 'الدفعات', icon: Wallet },
  { href: routes.accountMaintenance, label: 'الصيانة', icon: Wrench },
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
          'inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ease-smooth lg:w-full',
          active
            ? 'bg-navy text-white shadow-soft ring-1 ring-navy/10'
            : 'text-ink-muted hover:bg-navy/[0.04] hover:text-ink-strong',
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-gold-300' : 'text-gold-500')} aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
        {/* Profile — navy header band ties the sidebar to the brand hero above */}
        <div className="relative overflow-hidden bg-gradient-to-br from-navy-600 to-navy p-4 sm:p-5">
          <span
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gold-400/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-navy ring-1 ring-gold-300/60">
              <UserCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{fullName || 'حسابك'}</p>
              <span className="mt-1 inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gold-200 ring-1 ring-white/15">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {/* Nav — horizontal scroll on mobile, vertical on desktop */}
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {CLIENT_ITEMS.map(renderItem)}

          {isCustomer && (
            <>
              {/* Group separator: vertical line on mobile, full divider + label on desktop */}
              <span
                className="my-auto h-6 w-px shrink-0 bg-hairline/60 lg:my-2 lg:h-px lg:w-full"
                aria-hidden
              />
              <span className="hidden px-3.5 pb-1 text-[11px] font-medium text-ink-muted/70 lg:block">
                خدمات العميل
              </span>
              {CUSTOMER_ITEMS.map(renderItem)}
            </>
          )}

          {/* Logout — divided off on desktop, inline at the end on mobile */}
          <form action={logoutAction} className="ms-auto shrink-0 lg:ms-0 lg:mt-1 lg:w-full lg:border-t lg:border-hairline/60 lg:pt-1">
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
      </div>
    </aside>
  );
}
