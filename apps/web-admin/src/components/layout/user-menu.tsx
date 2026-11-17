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
          className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-[#E2C792]/20 bg-[#142036] p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.6)]"
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
          'flex w-full items-center gap-2.5 rounded-2xl border border-[#E2C792]/[0.10] p-2.5 text-start transition-colors duration-150 focus-visible:outline-none focus-visible:bg-white/[0.08]',
          open ? 'bg-[#F4EFE4]/[0.08]' : 'bg-[#F4EFE4]/[0.05] hover:bg-[#F4EFE4]/[0.08]',
        )}
      >
        <span className="relative inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[#E2C792]/25 bg-[linear-gradient(135deg,#C8A24B,#8A6A23)] text-[13px] font-semibold text-[#F4EFE4]">
          {initials}
          <span aria-hidden className="absolute bottom-0 start-0 h-2.5 w-2.5 rounded-full border-2 border-[#0B1220] bg-[#4CC38A] dark:border-[#0A101D]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-snug text-[#F7F3EA]">{name}</span>
          <span className="block truncate text-[11px] text-[#9A9486]">{role}</span>
        </span>
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#F4EFE4]/[0.06] text-[#B5AE9F]">
          <ChevronsUpDown className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
