/** Arabic-locale formatting helpers for the public website. */

const NUM = new Intl.NumberFormat('ar-SA');

/** The short Arabic symbol of each supported currency. */
const CURRENCY_SYMBOL: Record<string, string> = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق',
  BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', USD: '$',
};

/** The company currency's symbol ("ج.م" for EGP); unknown codes show as-is. */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

/**
 * Format a price (number or Decimal-string) as grouped digits + the company
 * currency's symbol ("٢٬٥٠٠٬٠٠٠ ج.م"). Avoids the currency style's odd
 * symbol/RLM spacing while keeping Arabic-Indic digits consistent with the
 * rest of the UI. `currency` is the company's (Company.currency, from the
 * public branding) — see lib/site-currency and components/currency.
 */
export function formatPrice(value: number | string | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${NUM.format(n)} ${currencySymbol(currency)}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return NUM.format(n);
}

export function formatArea(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${NUM.format(n)} م²`;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  studio: 'استوديو',
  apartment: 'شقة',
  '1br': 'شقة غرفة نوم',
  '2br': 'شقة غرفتين',
  '3br': 'شقة ثلاث غرف',
  '4br': 'شقة ٤ غرف',
  duplex: 'دوبلكس',
  penthouse: 'بنتهاوس',
  villa: 'فيلا',
  townhouse: 'تاون هاوس',
  'twin house': 'توين هاوس',
  chalet: 'شاليه',
  office: 'مكتب',
  retail: 'محل تجاري',
  shop: 'محل تجاري',
  clinic: 'عيادة',
  garage: 'جراج',
};

/**
 * A unit's type as a label: the company's name for it when the API sent one
 * (each company names its own types), else a label for a default code, else
 * the code itself.
 */
export function unitTypeLabel(
  type: string | null | undefined,
  name?: string | { ar?: string; en?: string } | null,
): string {
  const given = typeof name === 'string' ? name : name?.ar ?? name?.en;
  if (given?.trim()) return given;
  if (!type) return '—';
  return UNIT_TYPE_LABELS[type.toLowerCase()] ?? type;
}

const CITY_LABELS: Record<string, string> = {
  riyadh: 'الرياض',
  jeddah: 'جدة',
  jiddah: 'جدة',
  dammam: 'الدمام',
  mecca: 'مكة المكرمة',
  makkah: 'مكة المكرمة',
  medina: 'المدينة المنورة',
  madinah: 'المدينة المنورة',
  khobar: 'الخبر',
};

/** Normalize a city to a consistent Arabic label; falls back to the raw value. */
export function cityLabel(city: string | null | undefined): string {
  const v = city?.trim();
  if (!v) return 'موقع مميز';
  return CITY_LABELS[v.toLowerCase()] ?? v;
}

/** Pick the Arabic side of a translatable `{ ar, en }` JSON value. */
export function pickAr(value: unknown, fallback = ''): string {
  if (value && typeof value === 'object' && 'ar' in value) {
    const ar = (value as { ar?: unknown }).ar;
    if (typeof ar === 'string') return ar;
  }
  if (typeof value === 'string') return value;
  return fallback;
}
