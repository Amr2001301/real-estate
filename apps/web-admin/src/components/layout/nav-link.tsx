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
  const isWorkspaceRoot = href === '/dashboard' || href === '/portal';
  const isPrefix = !isWorkspaceRoot && pathname.startsWith(href + '/');
  const active = isExact || isPrefix;

  return (
    <Link
      href={href as never}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] font-medium transition-all duration-150 ease-smooth',
        active
          ? 'bg-brand-500 text-navy font-semibold shadow-sm'
          : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-active',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 transition-colors duration-150',
          active
            ? 'text-navy-700'
            : 'text-sidebar-text-muted group-hover:text-brand-400/70',
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
