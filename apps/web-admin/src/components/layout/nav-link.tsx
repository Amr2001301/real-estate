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
  const isPrefix = href !== '/dashboard' && pathname.startsWith(href + '/');
  const active = isExact || isPrefix;

  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 px-3 h-10 rounded-xl text-[13px] font-medium transition-all duration-150 ease-smooth',
        active
          ? 'bg-sidebar-bg-elev text-sidebar-text-active shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'
          : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-white',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute end-0 top-2 bottom-2 w-[3px] rounded-s-full transition-opacity',
          active ? 'bg-brand-500 opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 transition-colors',
          active
            ? 'text-brand-400'
            : 'text-sidebar-text-muted group-hover:text-sidebar-text',
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
