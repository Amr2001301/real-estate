'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale } from '@/lib/locale';

const LocaleContext = createContext<Locale>('ar');

/**
 * Hands the server's locale (the admin-locale cookie) to client components, so
 * their first render matches the server's. Reading the cookie in the browser
 * made the English screens fail to hydrate (QA run 2, English sweep).
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useClientLocale(): Locale {
  return useContext(LocaleContext);
}
