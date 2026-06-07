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
  // Workspace roots ('/dashboard', '/portal') must not prefix-match their
  // children, otherwise the home link stays highlighted on every sub-route.
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
        'group relative flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] font-medium transition-all duration-150 ease-smooth',
        active
          ? 'bg-brand-500/15 text-brand-300 shadow-[inset_0_0_0_1px_rgba(200,162,75,0.25)]'
          : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-active',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute end-0 top-1.5 bottom-1.5 w-1 rounded-s-full transition-all duration-150',
          active ? 'bg-brand-500 opacity-100 shadow-[0_0_8px_rgba(200,162,75,0.4)]' : 'opacity-0 w-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 transition-colors duration-150',
          active
            ? 'text-brand-400'
            : 'text-sidebar-text-muted group-hover:text-brand-400/70',
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
