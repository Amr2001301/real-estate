'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';

/** The row's secondary actions behind a "⋯" button; closes on outside click or Escape. */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        data-testid="visit-row-menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full border text-slate-500 transition-colors',
          open ? 'border-[#C9A24E]/60 text-slate-900' : 'border-hairline hover:border-[#C9A24E]/60 hover:text-slate-900',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          // Submit buttons keep the menu mounted: unmounting their form
          // before the browser submits it would cancel the submission.
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('button[type="submit"]')) setOpen(false);
          }}
          className="absolute end-0 top-11 z-30 flex min-w-[180px] flex-col rounded-2xl border border-hairline bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0_/_0.35)]"
        >
          {children}
        </div>
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
  tone?: 'default' | 'danger' | 'warning';
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
}: {
  icon: ReactNode;
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  tone?: 'brand' | 'success';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-bold transition-colors [&_svg]:h-4 [&_svg]:w-4',
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
