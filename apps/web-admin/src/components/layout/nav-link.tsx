'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

interface Props {
  href: string;
  label: string;
  icon?: ReactNode;
  onNavigate?: () => void;
  /** Items waiting (e.g. payment proofs to review); hidden at 0. */
  badge?: number;
  /** Other pages this link stands for (the settings page's): active on them too. */
  matches?: string[];
  /** A second line, e.g. the section a search result is in. */
  hint?: string;
}

/** Whether a link is the page you are on (or a page under it, or one it stands for). */
export function isNavActive(pathname: string, href: string, matches?: string[]): boolean {
  const on = (h: string) => {
    const isWorkspaceRoot = h === '/dashboard' || h === '/portal' || h === '/dashboard/super-admin';
    return pathname === h || (!isWorkspaceRoot && pathname.startsWith(h + '/'));
  };
  return on(href) || (matches ?? []).some(on);
}

export function NavLink({ href, label, icon, onNavigate, badge, matches, hint }: Props) {
  const pathname = usePathname() ?? '';
  const active = isNavActive(pathname, href, matches);

  return (
    <Link
      href={href as never}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 px-3.5 h-11 rounded-xl text-[14.5px] font-medium transition-all duration-150 ease-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset',
        // Active: gold-tinted background + gold dot (U5), not a solid gold pill.
        active
          ? 'bg-[#D8B66A]/[0.12] text-[#EBD29B] font-bold'
          : 'text-sidebar-text hover:bg-white/[0.06] hover:text-white/90',
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 transition-colors duration-150',
            active ? 'text-[#D8B66A]' : 'text-sidebar-text-muted group-hover:text-[#D8B66A]/80',
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-[11px] font-normal text-sidebar-text-muted">{hint}</span>}
      </span>
      {!!badge && badge > 0 && (
        <span
          data-testid="nav-badge"
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D8B66A] px-1.5 text-[11px] font-bold tabular-nums text-[#1A1408]"
        >
          {badge}
        </span>
      )}
      {/* U5: a ring per item; the active one is a filled gold dot. */}
      <span
        aria-hidden
        className={cn(
          'h-[7px] w-[7px] rounded-full shrink-0',
          active ? 'bg-[#D8B66A]' : 'border border-sidebar-text-muted/60 group-hover:border-[#D8B66A]/70',
        )}
      />
    </Link>
  );
}
