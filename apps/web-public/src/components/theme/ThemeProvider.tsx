'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';

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
      {children}
    </NextThemeProvider>
  );
}
