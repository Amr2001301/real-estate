/**
 * Pure, client-safe currency formatting helpers.
 * No server-only imports (next/headers, api.ts, cookies).
 *
 * Server components that also need getReportsCurrency should continue
 * importing from '@/lib/currency' (which is server-only due to api.ts).
 */

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

export function currencySymbol(code: string): string {
  return SYMBOL_MAP[code] ?? code;
}
