'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import type { NavSection } from '@/lib/nav';
import { IconButton } from '@/components/ui/icon-button';
import { SidebarContent } from './sidebar';

export function MobileNav({
  user,
  sections,
}: {
  user: SessionUser;
  sections?: NavSection[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <IconButton
        label="القائمة"
        variant="ghost"
        size="md"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </IconButton>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 end-0 w-[280px] max-w-[88vw] bg-sidebar-bg shadow-xl border-s border-sidebar-border">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="absolute top-5 start-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text-muted hover:text-white hover:bg-sidebar-bg-hover transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent user={user} sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
