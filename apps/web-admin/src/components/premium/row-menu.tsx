'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The row's actions behind a "⋯" button; closes on outside click, Escape, scroll or resize.
 * The menu is drawn at the page's top level at the button's position, so a table's
 * sideways-scroll box (or the card around it) can never clip it, even on the last row.
 */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 190;
    const H = menuRef.current?.offsetHeight ?? 150;
    const rtl = document.documentElement.dir === 'rtl' || window.getComputedStyle(btnRef.current!).direction === 'rtl';
    // The menu opens away from the page's edge: from the button's left edge in RTL (the
    // menu runs to the right), from its right edge in LTR (the menu runs to the left).
    const w = Math.max(W, menuRef.current?.offsetWidth ?? W);
    const left = Math.min(Math.max(8, rtl ? r.left : r.right - w), window.innerWidth - w - 8);
    const up = r.bottom + 6 + H > window.innerHeight && r.top - 6 - H > 0;
    setPos({ left, top: up ? r.top - 6 - H : r.bottom + 6, up });
  }

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        data-testid="row-menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border text-slate-500 transition-colors',
          open ? 'border-[#C9A24E]/60 text-slate-900' : 'border-hairline hover:border-[#C9A24E]/60 hover:text-slate-900',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            // Submit buttons keep the menu mounted: unmounting their form
            // before the browser submits it would cancel the submission.
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('button[type="submit"]')) setOpen(false);
            }}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
            className="z-50 flex min-w-[190px] flex-col rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0_/_0.35)]"
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** One menu entry; pass `type="submit"` inside a form. */
export function MenuItem({
  icon,
  children,
  tone = 'default',
  type = 'button',
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger' | 'warning' | 'success';
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13px] font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
        tone === 'danger' && 'text-danger-600 hover:bg-danger-500/10',
        tone === 'warning' && 'text-amber-600 hover:bg-amber-500/10',
        tone === 'success' && 'text-emerald-700 hover:bg-emerald-500/10',
        tone === 'default' && 'text-slate-700 hover:bg-surface-muted',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** The row's one main action, gold outline pill. */
export function PrimaryAction({
  icon,
  children,
  type = 'button',
  onClick,
  tone = 'brand',
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  tone?: 'brand' | 'success';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center disabled:opacity-50 gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-bold transition-colors [&_svg]:h-4 [&_svg]:w-4',
        tone === 'brand'
          ? 'border-[#C9A24E]/50 bg-[#C9A24E]/10 text-brand-700 hover:bg-[#C9A24E]/20'
          : 'border-success-500/40 bg-success-500/10 text-success-700 hover:bg-success-500/20',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
