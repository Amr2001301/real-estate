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
}

export function NavLink({ href, label, icon, onNavigate }: Props) {
  const pathname = usePathname() ?? '';
  const isExact = pathname === href;
  const isWorkspaceRoot = href === '/dashboard' || href === '/portal' || href === '/dashboard/super-admin';
  const isPrefix = !isWorkspaceRoot && pathname.startsWith(href + '/');
  const active = isExact || isPrefix;

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
      <span className="truncate flex-1">{label}</span>
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
