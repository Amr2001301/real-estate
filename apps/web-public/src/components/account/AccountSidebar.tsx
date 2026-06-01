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
          'inline-flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-200 ease-smooth lg:w-full',
          active
            ? 'bg-gradient-to-br from-gold-300 to-gold-500 font-semibold text-navy shadow-[0_10px_24px_-8px_rgba(200,162,75,0.55)]'
            : 'font-medium text-white/65 hover:bg-white/[0.07] hover:text-white',
        )}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-navy' : 'text-gold-300')} aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      {/* Floating dark-luxury panel: a navy slab that floats on the cream canvas
          for a high-end SaaS contrast, rounded-3xl with a soft gold edge glow. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-navy-700 to-navy p-3 shadow-lift ring-1 ring-white/10 sm:p-4">
        <span
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-gold-500/10 blur-3xl"
          aria-hidden
        />

        {/* Profile — an integrated translucent card inside the panel */}
        <div className="relative flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-navy shadow-[0_8px_20px_-6px_rgba(200,162,75,0.6)]">
            <UserCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{fullName || 'حسابك'}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gold-200 ring-1 ring-white/15">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="relative mt-3 px-0.5">
          {/* Nav — horizontal scroll on mobile, vertical on desktop */}
          <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
          {CLIENT_ITEMS.map(renderItem)}

          {isCustomer && (
            <>
              {/* Group separator: vertical line on mobile, full divider + label on desktop */}
              <span
                className="my-auto h-6 w-px shrink-0 bg-white/10 lg:my-2.5 lg:h-px lg:w-full"
                aria-hidden
              />
              <span className="hidden px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40 lg:block">
                خدمات العميل
              </span>
              {CUSTOMER_ITEMS.map(renderItem)}
            </>
          )}

          {/* Logout — divided off on desktop, inline at the end on mobile */}
          <form action={logoutAction} className="ms-auto shrink-0 lg:ms-0 lg:mt-2 lg:w-full lg:border-t lg:border-white/10 lg:pt-2">
            <button
              type="submit"
              className="inline-flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-white/55 transition-all duration-200 hover:bg-error/20 hover:text-white"
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
