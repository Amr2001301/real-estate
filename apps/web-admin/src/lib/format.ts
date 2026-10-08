import type { Locale } from '@/lib/locale';

/** The Intl tag each UI locale formats numbers and dates with. */
const INTL: Record<Locale, string> = { ar: 'ar-EG', en: 'en-EG' };

/** For direct Intl / toLocaleString calls: the tag the helpers below use. */
export function intlLocale(locale: Locale = 'ar'): string {
  return INTL[locale];
}

// Compact currency for KPI cards: "1.4م ج.م" / "75ك ج.م" / "500 ج.م";
// in English "1.4M EGP" / "75K EGP" / "500 EGP".
export function formatCompact(
  value: number | string | null | undefined,
  symbol = 'ج.م',
  locale: Locale = 'ar',
): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const [million, thousand] = locale === 'en' ? ['M', 'K'] : ['م', 'ك'];
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}${million} ${symbol}`;
  if (abs >= 1_000) {
    const k = n / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}${thousand} ${symbol}`;
  }
  return `${Math.round(n).toLocaleString(INTL[locale])} ${symbol}`;
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency = 'SAR',
  locale: Locale = 'ar',
): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(INTL[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined, locale: Locale = 'ar'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale = 'ar'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export interface Translatable { ar: string; en: string }
export function tx(value: Translatable | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ar || '—';
}

// Maintenance handling-SLA label (minutes → "يومان" / "3 ساعات"; "2 days" /
// "3 hours"). Whole days render in days, otherwise hours.
export function maintenanceSlaLabel(minutes: number | null | undefined, locale: Locale = 'ar'): string | null {
  if (minutes == null) return null;
  if (locale === 'en') {
    const [n, unit] = minutes % 1440 === 0 ? [minutes / 1440, 'day'] : [minutes / 60, 'hour'];
    return `${n.toLocaleString('en-EG')} ${unit}${n === 1 ? '' : 's'}`;
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : `${days.toLocaleString('ar-EG')} أيام`;
  }
  const hours = minutes / 60;
  return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours.toLocaleString('ar-EG')} ساعات`;
}

// Warranty-duration label (months → "سنتان" / "18 شهراً"; "2 years" / "18 months").
export function warrantyMonthsLabel(months: number | null | undefined, locale: Locale = 'ar'): string | null {
  if (months == null) return null;
  if (locale === 'en') {
    const [n, unit] = months % 12 === 0 ? [months / 12, 'year'] : [months, 'month'];
    return `${n.toLocaleString('en-EG')} ${unit}${n === 1 ? '' : 's'}`;
  }
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years.toLocaleString('ar-EG')} سنوات`;
  }
  return months === 1 ? 'شهر واحد' : `${months.toLocaleString('ar-EG')} شهراً`;
}
