import { formatDate, intlLocale, tx } from './format';
import type { Locale } from './locale';
import type { CustomerRecord } from './types';

export type CustomerFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';

/** One of the company's own customer fields (GET /customer-fields). */
export interface CustomerFieldDef {
  id: string;
  key: string;
  label: { ar: string; en: string };
  type: CustomerFieldType;
  options: string[];
  active: boolean;
  order: number;
}

/** The fixed details every customer can carry, beyond the name and contacts. */
export const FIXED_DETAILS = [
  { key: 'birthDate', placeholder: 'customer.birthDate', date: true, ar: 'تاريخ الميلاد', en: 'Date of birth' },
  { key: 'birthPlace', placeholder: 'customer.birthPlace', ar: 'محل الميلاد', en: 'Place of birth' },
  { key: 'occupation', placeholder: 'customer.occupation', ar: 'الوظيفة / المهنة', en: 'Occupation' },
  { key: 'employer', placeholder: 'customer.employer', ar: 'جهة العمل', en: 'Employer' },
  { key: 'nationalIdIssueDate', placeholder: 'customer.idIssueDate', date: true, ar: 'تاريخ إصدار الهوية', en: 'ID issue date' },
  { key: 'nationalIdIssuePlace', placeholder: 'customer.idIssuePlace', ar: 'جهة إصدار الهوية', en: 'ID issued at' },
  { key: 'homePhone', placeholder: 'customer.homePhone', ar: 'التليفون الأرضي', en: 'Home phone' },
] as const satisfies readonly {
  key: keyof CustomerRecord;
  placeholder: string;
  date?: boolean;
  ar: string;
  en: string;
}[];

/** A stored day ("1990-05-17" or its ISO midnight) as YYYY-MM-DD. */
export function dayOf(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : '';
}

/** A day as it reads: stored at UTC midnight, so formatted in UTC. */
export function formatDay(v: string | null | undefined, locale: Locale): string | null {
  return v ? formatDate(dayOf(v), locale, 'UTC') : null;
}

/** A company field's value as it reads on a page or a document. */
export function customValueText(f: CustomerFieldDef, v: string | number | undefined, locale: Locale): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (f.type === 'NUMBER') return new Intl.NumberFormat(intlLocale(locale)).format(Number(v));
  if (f.type === 'DATE') return formatDay(String(v), locale);
  return String(v);
}

export function fieldLabel(f: CustomerFieldDef, locale: Locale): string {
  return tx(f.label, locale) || f.key;
}
