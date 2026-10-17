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
      className="inline-flex h-10 min-w-[40px] items-center justify-center rounded-full px-3 text-[12px] font-bold tracking-wide text-slate-500 transition-colors duration-150 hover:bg-surface hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
    >
      {current === 'ar' ? 'EN' : 'عر'}
    </button>
  );
}
