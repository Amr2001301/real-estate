'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/locale';

const SiteLocaleContext = createContext<Locale>('ar');

/**
 * Hands the server's locale (the site-locale cookie) to client components, so
 * their first render matches the server's.
 */
export function SiteLocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <SiteLocaleContext.Provider value={locale}>{children}</SiteLocaleContext.Provider>;
}

export function useSiteLocale(): Locale {
  return useContext(SiteLocaleContext);
}
