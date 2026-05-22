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

// Maintenance handling-SLA label (minutes → "يومان" / "3 ساعات"). Whole days
// render in days, otherwise hours.
export function maintenanceSlaLabel(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : `${days.toLocaleString('ar-EG')} أيام`;
  }
  const hours = minutes / 60;
  return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours.toLocaleString('ar-EG')} ساعات`;
}

// Warranty-duration label (months → "سنتان" / "18 شهراً").
export function warrantyMonthsLabel(months: number | null | undefined): string | null {
  if (months == null) return null;
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years.toLocaleString('ar-EG')} سنوات`;
  }
  return months === 1 ? 'شهر واحد' : `${months.toLocaleString('ar-EG')} شهراً`;
}
