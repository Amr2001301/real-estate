import { PLACEHOLDER_GROUPS, customPlaceholder, type TemplateValues } from './document-template';
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

export type FormDocument = 'RESERVATION' | 'RECEIPT' | 'CONTRACT';

/** A form's pages at most: a contract runs to many. */
export const MAX_FORM_PAGES = 40;
/** A4, A5, or half an A4 sheet (landscape). */
export type PaperSize = 'A4' | 'A5' | 'HALF';

/** Each paper's size in mm. */
export const PAPER: Record<PaperSize, { w: number; h: number; css: string }> = {
  A4: { w: 210, h: 297, css: 'A4' },
  A5: { w: 148, h: 210, css: 'A5' },
  HALF: { w: 210, h: 148.5, css: '210mm 148.5mm' },
};

/** The sizes each document prints on: a booking form and a contract are A4. */
export const DOCUMENT_PAPER: Record<FormDocument, PaperSize[]> = {
  RESERVATION: ['A4'],
  CONTRACT: ['A4'],
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
/**
 * The signature boxes a document has: the payer does not sign a receipt. The
 * customer signs a booking form online; a contract's box is left for ink.
 */
export const signKeysFor = (doc: FormDocument): SignKey[] =>
  doc === 'RECEIPT' ? ['sign.company', 'sign.stamp'] : [...SIGN_KEYS];
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
    // A value the record lacks stays empty: the company's paper has its own line to fill by hand.
    isSignKey(f.key) ? { ...f, image: signs[f.key] ?? null } : { ...f, text: values[f.key] || '' },
  );
}

/**
 * The size a value prints at, in points: the field's own size, made smaller
 * when the text is too long for its box, so it stays on one line and whole.
 * Estimated from the length (about half an em a character) — no measuring,
 * so a server-rendered page and a phone agree.
 */
export function fitFontSize(field: Pick<FormField, 'w' | 'h' | 'size'>, text: string, paper: { w: number; h: number }): number {
  const PT_PER_MM = 72 / 25.4;
  const byWidth = (field.w * paper.w * PT_PER_MM) / Math.max(1, text.length * 0.55);
  const byHeight = (field.h * paper.h * PT_PER_MM) / 1.2;
  return Math.max(5, Math.min(field.size, byWidth, byHeight));
}
