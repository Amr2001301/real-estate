/**
 * Pure, client-safe currency formatting helpers.
 * No server-only imports (next/headers, api.ts, cookies).
 *
 * Server components that also need getReportsCurrency should continue
 * importing from '@/lib/currency' (which is server-only due to api.ts).
 */

import type { Locale } from './locale';

const SYMBOL_MAP: Record<string, string> = {
  SAR: 'ر.س',
  EGP: 'ج.م',
  USD: '$',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
};

/** The short symbol shown next to amounts; in English the ISO code (except $). */
export function currencySymbol(code: string, locale: Locale = 'ar'): string {
  if (locale === 'en') return code === 'USD' ? '$' : code;
  return SYMBOL_MAP[code] ?? code;
}

/**
 * The currencies a company can choose (the API accepts exactly these), with
 * their names for the pickers.
 */
export const CURRENCY_OPTIONS: { code: string; ar: string; en: string }[] = [
  { code: 'EGP', ar: 'جنيه مصري', en: 'Egyptian Pound' },
  { code: 'SAR', ar: 'ريال سعودي', en: 'Saudi Riyal' },
  { code: 'AED', ar: 'درهم إماراتي', en: 'UAE Dirham' },
  { code: 'KWD', ar: 'دينار كويتي', en: 'Kuwaiti Dinar' },
  { code: 'QAR', ar: 'ريال قطري', en: 'Qatari Riyal' },
  { code: 'BHD', ar: 'دينار بحريني', en: 'Bahraini Dinar' },
  { code: 'OMR', ar: 'ريال عماني', en: 'Omani Rial' },
  { code: 'JOD', ar: 'دينار أردني', en: 'Jordanian Dinar' },
  { code: 'USD', ar: 'دولار أمريكي', en: 'US Dollar' },
];
