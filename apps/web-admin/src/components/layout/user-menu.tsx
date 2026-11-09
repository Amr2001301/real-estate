'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isNavActive } from './nav-link';

interface Props {
  name: string;
  role: string;
  initials: string;
  settings?: { href: string; label: string; matches?: string[] };
  security: { href: string; label: string };
  logout: { label: string; action: (formData: FormData) => void | Promise<void> };
  onNavigate?: () => void;
}

const ROW =
  'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-start text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:bg-white/[0.08]';

/**
 * The sidebar's one footer row: who is signed in, and a menu above it with
 * what belongs to the account (settings, security and devices, sign out) —
 * so the foot of the sidebar is a single row, not five.
 */
export function UserMenu({ name, role, initials, settings, security, logout, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? '';

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const go = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={box} className="relative">
      {open && (
        <div
          role="menu"
          data-testid="user-menu"
          className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-[#D8B66A]/25 bg-[#101B30] p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)]"
        >
          {settings && (
            <Link
              role="menuitem"
              href={settings.href as never}
              onClick={go}
              className={cn(ROW, isNavActive(pathname, settings.href, settings.matches) ? 'text-[#EBD29B]' : 'text-sidebar-text hover:bg-white/[0.06] hover:text-white')}
            >
              <Settings className="h-4 w-4 shrink-0 text-[#D8B66A]" strokeWidth={1.8} aria-hidden />
              {settings.label}
            </Link>
          )}
          <Link role="menuitem" href={security.href as never} onClick={go} className={cn(ROW, 'text-sidebar-text hover:bg-white/[0.06] hover:text-white')}>
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#D8B66A]" strokeWidth={1.8} aria-hidden />
            {security.label}
          </Link>
          <div className="my-1 h-px bg-white/[0.08]" />
          <form action={logout.action}>
            <button type="submit" role="menuitem" className={cn(ROW, 'text-[#F09687] hover:bg-[#F09687]/10')}>
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
              {logout.label}
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        data-testid="user-menu-button"
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:bg-white/[0.08]',
          open ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]',
        )}
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B66A] to-[#B38B3A] text-[13px] font-bold text-[#1A1408]">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold leading-snug text-white">{name}</span>
          <span className="block truncate text-[11px] text-[#D8B66A]/85">{role}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-text-muted" aria-hidden />
      </button>
    </div>
  );
}
