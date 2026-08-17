'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

interface Props {
  href: string;
  label: string;
  icon: ReactNode;
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
        'group flex items-center gap-3 px-3 h-10 rounded-xl text-[13px] font-medium transition-all duration-150 ease-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset',
        active
          ? 'bg-brand-500/90 text-navy font-semibold shadow-[0_2px_12px_-3px_rgb(200_162_75/0.45),inset_0_1px_0_rgb(255_255_255/0.22)]'
          : 'text-sidebar-text/80 hover:bg-white/[0.08] hover:text-white/90',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 transition-colors duration-150',
          active
            ? 'text-navy/80'
            : 'text-sidebar-text-muted/70 group-hover:text-brand-300/75',
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
