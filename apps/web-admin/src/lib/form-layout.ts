import { PLACEHOLDER_GROUPS, BLANK, customPlaceholder, type TemplateValues } from './document-template';
import { fieldLabel as customFieldLabel, type CustomerFieldDef } from './customer-fields';

/**
 * The company's own paper form: its pages, and where each value goes on them.
 * Boxes are fractions of the page (0–1), text sizes in points, so a form
 * scanned at any resolution prints at its paper size.
 */
export interface FormField {
  id: string;
  /** A placeholder key ("customer.name") or a signature box ("sign.customer"). */
  key: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  align: 'start' | 'center' | 'end';
  bold?: boolean;
}

export type FormDocument = 'RESERVATION' | 'RECEIPT';
/** A4, A5, or half an A4 sheet (landscape). */
export type PaperSize = 'A4' | 'A5' | 'HALF';

/** Each paper's size in mm. */
export const PAPER: Record<PaperSize, { w: number; h: number; css: string }> = {
  A4: { w: 210, h: 297, css: 'A4' },
  A5: { w: 148, h: 210, css: 'A5' },
  HALF: { w: 210, h: 148.5, css: '210mm 148.5mm' },
};

/** The sizes each document prints on: a booking form is an A4 form. */
export const DOCUMENT_PAPER: Record<FormDocument, PaperSize[]> = {
  RESERVATION: ['A4'],
  RECEIPT: ['A4', 'A5', 'HALF'],
};

export interface FormLayout {
  id: string;
  documentType: FormDocument;
  name: string;
  paperSize: PaperSize;
  pages: { imageUrl: string }[];
  fields: FormField[];
  isDefault: boolean;
  updatedAt: string;
}

export const SIGN_KEYS = ['sign.customer', 'sign.company', 'sign.stamp'] as const;
export type SignKey = (typeof SIGN_KEYS)[number];
/** The signature boxes a document has: a receipt is not signed by the customer online. */
export const signKeysFor = (doc: FormDocument): SignKey[] =>
  doc === 'RESERVATION' ? [...SIGN_KEYS] : ['sign.company', 'sign.stamp'];
export const isSignKey = (k: string): k is SignKey => (SIGN_KEYS as readonly string[]).includes(k);

export const SIGN_LABELS: Record<SignKey, { ar: string; en: string }> = {
  'sign.customer': { ar: 'توقيع العميل', en: 'Customer signature' },
  'sign.company': { ar: 'توقيع الشركة', en: 'Company signature' },
  'sign.stamp': { ar: 'ختم الشركة', en: 'Company stamp' },
};

/** The values a document's form can carry, grouped as in the wording editor, the company's own fields last. */
export function formFieldGroups(documentType: FormDocument, customFields: CustomerFieldDef[] = []) {
  const own = customFields.filter((f) => f.active);
  return [
    ...PLACEHOLDER_GROUPS,
    ...(own.length
      ? [
          {
            ar: 'خانات الشركة',
            en: 'Your fields',
            items: own.map((f) => ({
              key: customPlaceholder(f.key),
              ar: customFieldLabel(f, 'ar'),
              en: customFieldLabel(f, 'en'),
              docs: [documentType],
            })),
          },
        ]
      : []),
  ]
    .map((g) => ({ ...g, items: g.items.filter((p) => p.docs.includes(documentType)) }))
    .filter((g) => g.items.length);
}

/** A field's label for the designer. */
export function fieldLabel(key: string, locale: 'ar' | 'en', customFields: CustomerFieldDef[] = []): string {
  if (isSignKey(key)) return SIGN_LABELS[key][locale];
  for (const g of PLACEHOLDER_GROUPS) for (const p of g.items) if (p.key === key) return locale === 'en' ? p.en : p.ar;
  const own = customFields.find((f) => customPlaceholder(f.key) === key);
  return own ? customFieldLabel(own, locale) : key;
}

/** What a form prints: each text box filled, each signature box with its image (or empty). */
export interface FilledField extends FormField {
  text?: string;
  image?: string | null;
}

export function fillForm(
  layout: Pick<FormLayout, 'fields'>,
  values: TemplateValues,
  signs: Partial<Record<SignKey, string | null>>,
): FilledField[] {
  return layout.fields.map((f) =>
    isSignKey(f.key) ? { ...f, image: signs[f.key] ?? null } : { ...f, text: values[f.key] || BLANK },
  );
}
