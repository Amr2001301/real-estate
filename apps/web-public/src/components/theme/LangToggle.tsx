'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';

export function LangToggle({ current, className }: { current: Locale; className?: string }) {
  const router = useRouter();

  function toggle() {
    const next: Locale = current === 'ar' ? 'en' : 'ar';
    document.cookie = `site-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={current === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-bold tracking-wide transition-colors',
        'text-ink-muted hover:bg-ink-muted/10 hover:text-ink-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60',
        className,
      )}
    >
      {current === 'ar' ? 'EN' : 'عر'}
    </button>
  );
}
