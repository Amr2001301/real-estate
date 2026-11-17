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
  /** A top-level row: the same size and icon column as a section's header. */
  wide?: boolean;
}

/** Whether a link is the page you are on (or a page under it, or one it stands for). */
export function isNavActive(pathname: string, href: string, matches?: string[]): boolean {
  const on = (h: string) => {
    const isWorkspaceRoot = h === '/dashboard' || h === '/portal' || h === '/dashboard/super-admin';
    return pathname === h || (!isWorkspaceRoot && pathname.startsWith(h + '/'));
  };
  return on(href) || (matches ?? []).some(on);
}

export function NavLink({ href, label, icon, onNavigate, badge, matches, hint, dense, wide }: Props) {
  const pathname = usePathname() ?? '';
  const active = isNavActive(pathname, href, matches);

  return (
    <Link
      href={href as never}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-[10px] text-[13px] transition-colors duration-150 ease-smooth',
        dense ? 'h-[38px] px-3.5' : wide ? 'h-[42px] px-3 text-[13.5px]' : 'h-10 px-3',
        'focus-visible:outline-none focus-visible:bg-white/[0.06]',
        // Active: a gold wash fading from the guide line, and a gold bar on it.
        active
          ? 'font-semibold text-[#F7F3EA] rtl:bg-[linear-gradient(270deg,rgba(200,162,75,0.20)_0%,rgba(200,162,75,0.04)_100%)] ltr:bg-[linear-gradient(90deg,rgba(200,162,75,0.20)_0%,rgba(200,162,75,0.04)_100%)] ' +
              'before:absolute before:bottom-[9px] before:top-[9px] before:w-[3px] before:rounded-full before:bg-[linear-gradient(135deg,#EAD5A3,#C8A24B,#9E7A2B)] ' +
              (dense ? 'before:-start-px' : 'before:start-0')
          : 'font-normal text-[#A39D90] hover:bg-white/[0.05] hover:text-[#F4EFE4]',
      )}
    >
      {icon && !dense && (
        <span
          aria-hidden
          className={cn(
            'shrink-0 transition-colors duration-150 [&>svg]:h-4 [&>svg]:w-4',
            wide ? 'grid h-[30px] w-[30px] place-items-center rounded-[9px] [&>svg]:h-[17px] [&>svg]:w-[17px]' : 'inline-flex',
            wide && active && 'bg-[linear-gradient(135deg,rgba(234,213,163,0.22),rgba(200,162,75,0.08))]',
            active ? 'text-[#E2C792]' : 'text-[#8F897C] group-hover:text-[#C8A24B]/80',
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
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C8A24B] px-1.5 font-[Inter,system-ui,sans-serif] text-[11px] font-semibold tabular-nums text-[#0B1220]"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
