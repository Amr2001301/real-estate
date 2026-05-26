/**
 * Public listing sort options (Arabic labels). The empty value means "no `sort`
 * param" → the backend's default ordering. Mirrors the whitelisted backend
 * enums (ProjectSort / UnitSort).
 *
 * Projects: only createdAt is a safe sortable field — Project has no price
 * column and `name` is JSON (not orderable), so price/name sorts are omitted.
 */
export interface SortOption {
  value: string;
  label: string;
}

export const PROJECT_SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'الأحدث' },
  { value: 'oldest', label: 'الأقدم' },
];

export const UNIT_SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'الافتراضي' },
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: من الأقل للأعلى' },
  { value: 'price_desc', label: 'السعر: من الأعلى للأقل' },
  { value: 'area_asc', label: 'المساحة: من الأقل للأعلى' },
  { value: 'area_desc', label: 'المساحة: من الأعلى للأقل' },
  { value: 'bedrooms_asc', label: 'الغرف: من الأقل للأعلى' },
  { value: 'bedrooms_desc', label: 'الغرف: من الأعلى للأقل' },
];
