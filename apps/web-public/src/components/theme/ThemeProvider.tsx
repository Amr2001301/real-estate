'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';

/**
 * Paper is always light: while the browser prints, drop the dark class (and
 * the dark color-scheme), then put both back.
 */
function PrintLight() {
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    let scheme = '';
    const before = () => {
      wasDark = root.classList.contains('dark');
      scheme = root.style.colorScheme;
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    };
    const after = () => {
      if (wasDark) root.classList.add('dark');
      root.style.colorScheme = scheme;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return null;
}

/**
 * Wraps the app in next-themes so the user's choice (light / dark / system)
 * persists to localStorage and toggles the `.dark` class on <html>, which the
 * CSS custom properties in globals.css key off. `attribute="class"` matches
 * Tailwind's `darkMode: 'class'` setting.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PrintLight />
      {children}
    </NextThemeProvider>
  );
}
