'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { SessionUser } from '@/lib/session';
import type { Locale } from '@/lib/locale';
import type { NavSection } from '@/lib/nav';
import { IconButton } from '@/components/ui/icon-button';
import { SidebarContent } from './sidebar';

export function MobileNav({
  user,
  sections,
  locale,
}: {
  user: SessionUser;
  sections?: NavSection[];
  locale: Locale;
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

  const menuLabel = locale === 'ar' ? 'القائمة' : 'Menu';
  const closeLabel = locale === 'ar' ? 'إغلاق' : 'Close';

  return (
    <>
      <IconButton
        label={menuLabel}
        variant="ghost"
        size="md"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </IconButton>

      {/* Portalled to <body>: the top bar's backdrop-blur makes it the containing
          block for fixed children, which squeezed the drawer into the bar's height. */}
      {open && createPortal(
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 start-0 w-[300px] max-w-[86vw] bg-sidebar-bg shadow-2xl border-e border-sidebar-border animate-fade-in">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
              className="absolute top-6 end-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-text-muted hover:text-white hover:bg-sidebar-bg-hover transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent user={user} locale={locale} sections={sections} onNavigate={() => setOpen(false)} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
