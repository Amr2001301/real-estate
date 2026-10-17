'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const STORAGE_KEY = 'admin-theme';

function getStoredTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(STORAGE_KEY) as 'light' | 'dark') ?? 'light';
}

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

interface Props {
  /** Short labels shown on the pill: the theme a click switches to. */
  labels?: { light: string; dark: string; toLight: string; toDark: string };
}

/** Light / dark switch for the top bar (U5). The theme script applies the stored choice before paint. */
export function ThemeToggle({ labels }: Props) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  }

  const toDark = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toDark ? (labels?.toDark ?? 'Switch to dark mode') : (labels?.toLight ?? 'Switch to light mode')}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[13px] font-bold text-slate-800 transition-colors duration-150 hover:border-brand-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45"
    >
      {toDark ? (
        <Moon className="h-[15px] w-[15px]" aria-hidden />
      ) : (
        <Sun className="h-[15px] w-[15px] text-brand-700" aria-hidden />
      )}
      {labels && <span>{toDark ? labels.dark : labels.light}</span>}
    </button>
  );
}
