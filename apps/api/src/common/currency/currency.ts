import type { PrismaClient } from '@prisma/client';

/**
 * The company's currency is the single source for every amount the platform
 * shows: dashboard (every role), broker portal, public site, mobile apps,
 * notifications and the chat bot. It is `Company.currency`, set by the
 * company admin from the branding page.
 */
export const SUPPORTED_CURRENCIES = ['EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'USD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/** New companies, and any company whose stored value is not supported. */
export const DEFAULT_CURRENCY: CurrencyCode = 'EGP';

export function isSupportedCurrency(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export function normalizeCurrency(code: unknown): CurrencyCode {
  const upper = typeof code === 'string' ? code.trim().toUpperCase() : '';
  return isSupportedCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

/** The short Arabic symbol of each currency (as shown next to amounts). */
const ARABIC_SYMBOL: Record<CurrencyCode, string> = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق',
  BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', USD: '$',
};

export function arabicCurrencySymbol(code: unknown): string {
  return ARABIC_SYMBOL[normalizeCurrency(code)];
}

type CompanyReader = Pick<PrismaClient, 'company'>;

export async function getCompanyCurrency(db: CompanyReader, companyId: string | null | undefined): Promise<CurrencyCode> {
  if (!companyId) return DEFAULT_CURRENCY;
  try {
    const row = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });
    return normalizeCurrency(row?.currency);
  } catch {
    // Formatting an amount must never fail the notification, summary or chat
    // reply it belongs to.
    return DEFAULT_CURRENCY;
  }
}

/**
 * An amount as text for messages (notifications, emails, chat): grouped
 * digits and the currency, in the reader's language — "٢٬٥٠٠٬٠٠٠ ج.م." /
 * "EGP 2,500,000". Whole amounts drop the decimals. Non-numeric input is
 * returned unchanged.
 */
export function formatMoney(amount: unknown, currency: string, locale: 'ar' | 'en'): string {
  const n = typeof amount === 'number' ? amount : Number(String(amount ?? '').trim());
  if (amount === null || amount === undefined || String(amount).trim() === '' || !Number.isFinite(n)) {
    return amount === null || amount === undefined ? '' : String(amount);
  }
  return new Intl.NumberFormat(locale === 'en' ? 'en-EG' : 'ar-EG', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    // Whole amounts without decimals; anything else with exactly two.
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}
