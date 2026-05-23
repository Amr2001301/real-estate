/** Arabic-locale formatting helpers for the public website. */

const SAR = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('ar-SA');

/** Format a price (number or Decimal-string from the API) as SAR. */
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return SAR.format(n);
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

/** Pick the Arabic side of a translatable `{ ar, en }` JSON value. */
export function pickAr(value: unknown, fallback = ''): string {
  if (value && typeof value === 'object' && 'ar' in value) {
    const ar = (value as { ar?: unknown }).ar;
    if (typeof ar === 'string') return ar;
  }
  if (typeof value === 'string') return value;
  return fallback;
}
