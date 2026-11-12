'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
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
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { logoutAction } from '@/lib/auth-actions';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

type SidebarKey = keyof ReturnType<typeof siteT>['account']['sidebar'];

interface SidebarItem {
  href: string;
  labelKey: SidebarKey;
  icon: typeof LayoutGrid;
}

const CLIENT_ITEMS: SidebarItem[] = [
  { href: routes.account, labelKey: 'dashboard', icon: LayoutGrid },
  { href: routes.accountProfile, labelKey: 'profile', icon: UserCircle2 },
  { href: routes.accountFavorites, labelKey: 'favorites', icon: Heart },
  { href: routes.accountVisits, labelKey: 'visits', icon: CalendarClock },
  { href: routes.accountRequests, labelKey: 'requests', icon: MessageSquareText },
  // P7 — reservations visible to BOTH CLIENT and CUSTOMER
  { href: routes.accountReservations, labelKey: 'reservations', icon: BookmarkCheck },
  // P5 — notifications reachable by every portal role
  { href: routes.accountNotifications, labelKey: 'notifications', icon: Bell },
];

/**
 * An owner's own services come first — what they open every month — then
 * the pre-purchase pages (favourites, visits, requests, reservations) under
 * their own heading, then the profile (owner, 2026-11-12). The schedule and
 * the recorded payments are one entry, «المدفوعات», with two tabs.
 */
const OWNER_ITEMS: SidebarItem[] = [
  { href: routes.account, labelKey: 'dashboard', icon: LayoutGrid },
  { href: routes.accountProperty, labelKey: 'property', icon: Building2 },
  { href: routes.accountInstallments, labelKey: 'payments', icon: Wallet },
  { href: routes.accountContracts, labelKey: 'contracts', icon: FileText },
  { href: routes.accountMaintenance, labelKey: 'maintenance', icon: Wrench },
  { href: routes.accountDocuments, labelKey: 'documents', icon: FolderOpen },
  { href: routes.accountNotifications, labelKey: 'notifications', icon: Bell },
];

const OWNER_BROWSING: SidebarItem[] = [
  { href: routes.accountReservations, labelKey: 'reservations', icon: BookmarkCheck },
  { href: routes.accountVisits, labelKey: 'visits', icon: CalendarClock },
  { href: routes.accountRequests, labelKey: 'requests', icon: MessageSquareText },
  { href: routes.accountFavorites, labelKey: 'favorites', icon: Heart },
];

function isActive(pathname: string, href: string): boolean {
  if (href === routes.account) return pathname === href;
  const under = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  // «المدفوعات» covers both of its tabs.
  if (href === routes.accountInstallments) return under(routes.accountInstallments) || under(routes.accountDeposits);
  return under(href);
}

function getInitials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function AccountSidebar({
  fullName,
  roleLabel,
  avatarUrl,
  isCustomer = false,
  unreadNotifications = 0,
  locale = 'ar',
}: {
  fullName?: string;
  roleLabel: string;
  avatarUrl?: string | null;
  isCustomer?: boolean;
  unreadNotifications?: number;
  locale?: Locale;
}) {
  const pathname = usePathname();
  const m = siteT(locale);
  // On a phone the menu is a sideways strip: keep the current page in view.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    current.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  const renderItem = ({ href, labelKey, icon: Icon }: SidebarItem) => {
    const active = isActive(pathname, href);
    const label = m.account.sidebar[labelKey];
    const badgeCount = href === routes.accountNotifications ? unreadNotifications : 0;
    return (
      <Link
        key={href}
        href={href as Route}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200 ease-smooth lg:w-full',
          active
            ? 'bg-gold-400 font-semibold text-[#1B1206]'
            : 'font-medium text-white/70 hover:bg-white/[0.08] hover:text-white',
        )}
      >
        <Icon
          className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-[#1B1206]' : 'text-gold-300/90')}
          aria-hidden
        />
        {label}
        {badgeCount > 0 && (
          <span
            aria-label={`${badgeCount} ${locale === 'ar' ? 'إشعار غير مقروء' : 'unread notifications'}`}
            className={cn(
              'ms-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none',
              active ? 'bg-[#1B1206] text-gold-300' : 'bg-gold-400 text-[#1B1206]',
            )}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-navy-700 to-navy p-3 shadow-card ring-1 ring-white/10 sm:p-4">
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/50 to-transparent"
          aria-hidden
        />
        <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />

        {/* Profile */}
        <div className="relative flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          {avatarUrl ? (
            <span
              className="h-12 w-12 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-gold-300/60"
              style={{ backgroundImage: `url(${avatarUrl})` }}
              role="img"
              aria-label={fullName || m.account.yourAccount}
            />
          ) : (
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 font-display text-base font-semibold text-[#1B1206]">
              {getInitials(fullName)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{fullName || m.account.yourAccount}</p>
            <span className="mt-1 inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gold-200 ring-1 ring-white/15">
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="relative mt-3 px-0.5">
          <nav ref={navRef} className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
            {isCustomer ? (
              <>
                {OWNER_ITEMS.map(renderItem)}
                <span className="my-auto h-6 w-px shrink-0 bg-white/10 lg:my-2.5 lg:h-px lg:w-full" aria-hidden />
                <span className="hidden px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40 lg:block">
                  {m.account.sidebar.browsing}
                </span>
                {OWNER_BROWSING.map(renderItem)}
                {renderItem({ href: routes.accountProfile, labelKey: 'profile', icon: UserCircle2 })}
              </>
            ) : (
              CLIENT_ITEMS.map(renderItem)
            )}

            <form
              action={logoutAction}
              className="ms-auto shrink-0 lg:ms-0 lg:mt-2 lg:w-full lg:border-t lg:border-white/10 lg:pt-2"
            >
              <button
                type="submit"
                className="inline-flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-white/55 transition-all duration-200 hover:bg-error/20 hover:text-white"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
                {m.account.sidebar.logout}
              </button>
            </form>
          </nav>
        </div>
      </div>
    </aside>
  );
}
