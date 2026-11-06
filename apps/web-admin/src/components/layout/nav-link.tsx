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
  /** Inside an opened section: shorter, with the gold bar on its guide line. */
  dense?: boolean;
}

/** Whether a link is the page you are on (or a page under it, or one it stands for). */
export function isNavActive(pathname: string, href: string, matches?: string[]): boolean {
  const on = (h: string) => {
    const isWorkspaceRoot = h === '/dashboard' || h === '/portal' || h === '/dashboard/super-admin';
    return pathname === h || (!isWorkspaceRoot && pathname.startsWith(h + '/'));
  };
  return on(href) || (matches ?? []).some(on);
}

export function NavLink({ href, label, icon, onNavigate, badge, matches, hint, dense }: Props) {
  const pathname = usePathname() ?? '';
  const active = isNavActive(pathname, href, matches);

  return (
    <Link
      href={href as never}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-[10px] text-[13.5px] font-medium transition-colors duration-150 ease-smooth',
        dense ? 'h-9 px-2.5' : 'h-10 px-3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset',
        // Active: a gold wash and a gold bar on the guide line.
        active
          ? 'bg-[#D8B66A]/[0.12] font-bold text-[#EBD29B] before:absolute before:bottom-2 before:top-2 before:w-[3px] before:rounded-full before:bg-[#D8B66A] ' +
              (dense ? 'before:-start-[9px]' : 'before:start-0')
          : 'text-sidebar-text hover:bg-white/[0.06] hover:text-white/90',
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 transition-colors duration-150 [&>svg]:h-4 [&>svg]:w-4',
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
    </Link>
  );
}
