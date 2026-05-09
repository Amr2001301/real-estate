export function formatCurrency(value: number | string | null | undefined, currency = 'SAR'): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export interface Translatable { ar: string; en: string }
export function tx(value: Translatable | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ar || '—';
}
