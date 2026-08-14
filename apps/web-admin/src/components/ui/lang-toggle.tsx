'use client';

import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';

export function LangToggle({ current }: { current: Locale }) {
  const router = useRouter();

  function toggle() {
    const next: Locale = current === 'ar' ? 'en' : 'ar';
    // Persist preference in cookie (1 year)
    document.cookie = `admin-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    // Update html attributes immediately to avoid layout flash
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    // Re-render server components with new locale
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={current === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      title={current === 'ar' ? 'English' : 'عربي'}
      className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-xl px-2.5 text-[11px] font-bold tracking-wide text-slate-400/70 transition-colors duration-150 hover:bg-slate-100/70 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
    >
      {current === 'ar' ? 'EN' : 'عر'}
    </button>
  );
}
