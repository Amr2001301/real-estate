'use client';

import { createContext, useContext } from 'react';
import { formatPrice } from '@/lib/format';

const CurrencyContext = createContext('EGP');

/** Set once in the root layout from the company's branding. */
export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

/** The company's currency (Company.currency) in client components. */
export function useCurrency(): string {
  return useContext(CurrencyContext);
}

/** A price in the company's currency — usable from server and client components. */
export function Price({ value }: { value: number | string | null | undefined }) {
  return <>{formatPrice(value, useCurrency())}</>;
}
