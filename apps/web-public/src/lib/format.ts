import type { Locale } from '@/lib/locale';

/** Formatting helpers for the public website (Arabic by default; English when asked). */

// Western digits on the Arabic site too, like the dashboard and the apps
// (owner's choice with the new homepage): «3,450,000 ج.م», not «٣٬٤٥٠٬٠٠٠».
const NUM = new Intl.NumberFormat('ar-SA-u-nu-latn');
const NUM_EN = new Intl.NumberFormat('en-US');
const numFor = (locale: Locale) => (locale === 'en' ? NUM_EN : NUM);

/** The short Arabic symbol of each supported currency. */
const CURRENCY_SYMBOL: Record<string, string> = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق',
  BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', USD: '$',
};

/** English reads the ISO code (EGP, SAR…); the dollar keeps its sign. */
const CURRENCY_SYMBOL_EN: Record<string, string> = { USD: '$' };

/** The company currency's symbol ("ج.م" for EGP, "EGP" in English); unknown codes show as-is. */
export function currencySymbol(currency: string, locale: Locale = 'ar'): string {
  if (locale === 'en') return CURRENCY_SYMBOL_EN[currency] ?? currency;
  return CURRENCY_SYMBOL[currency] ?? currency;
}

/**
 * Format a price (number or Decimal-string) as grouped digits + the company
 * currency's symbol ("2,500,000 ج.م"). Avoids the currency style's odd
 * symbol/RLM spacing while keeping Arabic-Indic digits consistent with the
 * rest of the UI. `currency` is the company's (Company.currency, from the
 * public branding) — see lib/site-currency and components/currency.
 */
export function formatPrice(value: number | string | null | undefined, currency: string, locale: Locale = 'ar'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${numFor(locale).format(n)} ${currencySymbol(currency, locale)}`;
}

export function formatNumber(value: number | string | null | undefined, locale: Locale = 'ar'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return numFor(locale).format(n);
}

/** A big amount in short form: «2.4 مليون» / "2.4M"; "—" when missing. */
export function formatCompact(value: number | string | null | undefined, locale: Locale = 'ar'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ar-EG-u-nu-latn', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatArea(value: number | string | null | undefined, locale: Locale = 'ar'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${numFor(locale).format(n)} ${locale === 'en' ? 'm²' : 'م²'}`;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  studio: 'استوديو',
  apartment: 'شقة',
  '1br': 'شقة غرفة نوم',
  '2br': 'شقة غرفتين',
  '3br': 'شقة ثلاث غرف',
  '4br': 'شقة 4 غرف',
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

const UNIT_TYPE_LABELS_EN: Record<string, string> = {
  studio: 'Studio',
  apartment: 'Apartment',
  '1br': '1-bedroom apartment',
  '2br': '2-bedroom apartment',
  '3br': '3-bedroom apartment',
  '4br': '4-bedroom apartment',
  duplex: 'Duplex',
  penthouse: 'Penthouse',
  villa: 'Villa',
  townhouse: 'Townhouse',
  'twin house': 'Twin house',
  chalet: 'Chalet',
  office: 'Office',
  retail: 'Retail shop',
  shop: 'Shop',
  clinic: 'Clinic',
  garage: 'Garage',
};

/**
 * A unit's type as a label: the company's name for it when the API sent one
 * (each company names its own types), else a label for a default code, else
 * the code itself.
 */
export function unitTypeLabel(
  type: string | null | undefined,
  name?: string | { ar?: string; en?: string } | null,
  locale: Locale = 'ar',
): string {
  const given = typeof name === 'string' ? name : locale === 'en' ? name?.en ?? name?.ar : name?.ar ?? name?.en;
  if (given?.trim()) return given;
  if (!type) return '—';
  const table = locale === 'en' ? UNIT_TYPE_LABELS_EN : UNIT_TYPE_LABELS;
  return table[type.toLowerCase()] ?? type;
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

/** English names of cities a company may have typed in Arabic (the data has one text). */
const CITY_LABELS_EN: Record<string, string> = {
  riyadh: 'Riyadh', jeddah: 'Jeddah', jiddah: 'Jeddah', dammam: 'Dammam', mecca: 'Makkah', makkah: 'Makkah',
  medina: 'Madinah', madinah: 'Madinah', khobar: 'Khobar',
  'الرياض': 'Riyadh', 'جدة': 'Jeddah', 'الدمام': 'Dammam', 'مكة المكرمة': 'Makkah', 'المدينة المنورة': 'Madinah', 'الخبر': 'Khobar',
  'القاهرة': 'Cairo', 'القاهرة الجديدة': 'New Cairo', 'الجيزة': 'Giza', 'الإسكندرية': 'Alexandria', 'الاسكندرية': 'Alexandria',
  'السادس من أكتوبر': '6th of October', '6 أكتوبر': '6th of October', 'الشيخ زايد': 'Sheikh Zayed', 'العاصمة الإدارية': 'New Administrative Capital',
  'العاصمة الإدارية الجديدة': 'New Administrative Capital', 'العين السخنة': 'Ain Sokhna', 'الساحل الشمالي': 'North Coast',
  'الغردقة': 'Hurghada', 'شرم الشيخ': 'Sharm El Sheikh', 'المنصورة': 'Mansoura', 'التجمع الخامس': 'Fifth Settlement',
  'الشروق': 'El Shorouk', 'المستقبل سيتي': 'Mostakbal City', 'مدينة نصر': 'Nasr City', 'المعادي': 'Maadi', 'الزمالك': 'Zamalek',
};

/** Normalize a city to a consistent label; falls back to the raw value. */
export function cityLabel(city: string | null | undefined, locale: Locale = 'ar'): string {
  const v = city?.trim();
  if (!v) return locale === 'en' ? 'Prime location' : 'موقع مميز';
  if (locale === 'en') return CITY_LABELS_EN[v.toLowerCase()] ?? CITY_LABELS_EN[v] ?? v;
  return CITY_LABELS[v.toLowerCase()] ?? v;
}

/** Pick the visitor's side of a translatable `{ ar, en }` JSON value (Arabic unless asked). */
export function pickAr(value: unknown, fallback = '', locale: Locale = 'ar'): string {
  if (value && typeof value === 'object' && ('ar' in value || 'en' in value)) {
    const v = value as { ar?: unknown; en?: unknown };
    const first = locale === 'en' ? v.en : v.ar;
    const second = locale === 'en' ? v.ar : v.en;
    if (typeof first === 'string' && first) return first;
    if (typeof second === 'string' && second) return second;
  }
  if (typeof value === 'string') return value;
  return fallback;
}

/** A medium date ("7 Nov 2026" / «7 نوفمبر 2026»); "—" when missing or invalid. */
export function formatDateShort(iso: string | null | undefined, locale: Locale = 'ar'): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-u-nu-latn', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/** A medium date with the short time; "—" when missing or invalid. */
export function formatDateTimeShort(iso: string | null | undefined, locale: Locale = 'ar'): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}
