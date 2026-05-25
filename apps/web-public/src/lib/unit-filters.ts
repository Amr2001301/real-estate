/**
 * Shared unit-filter constants. Kept in a plain (non-"use client") module so
 * both the server `units/page.tsx` and the client `UnitsFilterBar` can import
 * them — importing a const from a client module into a server component turns
 * it into a client-reference proxy (and crashes on `.find`).
 */

export interface PriceRange {
  value: string;
  label: string;
  min: string;
  max: string;
}

export const PRICE_RANGES: PriceRange[] = [
  { value: '', label: 'كل الأسعار', min: '', max: '' },
  { value: '0-500000', label: 'حتى ٥٠٠ ألف', min: '', max: '500000' },
  { value: '500000-1000000', label: '٥٠٠ ألف – مليون', min: '500000', max: '1000000' },
  { value: '1000000-2000000', label: 'مليون – مليونان', min: '1000000', max: '2000000' },
  { value: '2000000-', label: 'أكثر من مليونين', min: '2000000', max: '' },
];

export interface AreaRange {
  value: string;
  label: string;
  min: string;
  max: string;
}

export const AREA_RANGES: AreaRange[] = [
  { value: '', label: 'كل المساحات', min: '', max: '' },
  { value: '0-100', label: 'أقل من ١٠٠ م²', min: '', max: '100' },
  { value: '100-150', label: '١٠٠ – ١٥٠ م²', min: '100', max: '150' },
  { value: '150-200', label: '١٥٠ – ٢٠٠ م²', min: '150', max: '200' },
  { value: '200-300', label: '٢٠٠ – ٣٠٠ م²', min: '200', max: '300' },
  { value: '300-', label: 'أكثر من ٣٠٠ م²', min: '300', max: '' },
];

export const UNIT_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'كل الأنواع' },
  { value: 'studio', label: 'استوديو' },
  { value: '1BR', label: 'غرفة نوم' },
  { value: '2BR', label: 'غرفتا نوم' },
  { value: '3BR', label: 'ثلاث غرف' },
  { value: 'villa', label: 'فيلا' },
  { value: 'townhouse', label: 'تاون هاوس' },
  { value: 'office', label: 'مكتب' },
  { value: 'retail', label: 'محل تجاري' },
];

export const ROOM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'الكل' },
  { value: '1', label: '١' },
  { value: '2', label: '٢' },
  { value: '3', label: '٣' },
  { value: '4', label: '٤+' },
];

/** Map a (min,max) pair back to a range `value`. Safe fallback to ''. */
export function derivePriceValue(min: string, max: string): string {
  if (!Array.isArray(PRICE_RANGES)) return '';
  return PRICE_RANGES.find((r) => r.min === min && r.max === max)?.value ?? '';
}

/** Map an (areaMin,areaMax) pair back to an area-range `value`. Safe fallback to ''. */
export function deriveAreaValue(min: string, max: string): string {
  if (!Array.isArray(AREA_RANGES)) return '';
  return AREA_RANGES.find((r) => r.min === min && r.max === max)?.value ?? '';
}
