import { cache } from 'react';
import { api, safe } from './api';

export type LetterheadMode = 'BUILT_IN' | 'HEADER_FOOTER' | 'FULL_PAGE';
export type SealDocument = 'CONTRACT' | 'RESERVATION' | 'RECEIPT' | 'STATEMENT';
export type TemplateDocument = 'CONTRACT' | 'RESERVATION';
export type TemplateVariant = 'ANY' | 'CASH' | 'INSTALLMENT';

/** How the company's documents print (GET /company/print-settings). */
export interface PrintSettings {
  letterheadMode: LetterheadMode;
  headerImageUrl: string | null;
  footerImageUrl: string | null;
  pageImageUrl: string | null;
  marginTopMm: number;
  marginBottomMm: number;
  marginSideMm: number;
  signatoryName: string | null;
  signatoryTitle: string | null;
  /** data: URIs — sent only to the company's own staff. */
  signature: string | null;
  stamp: string | null;
  sealDocuments: SealDocument[];
}

export interface DocumentTemplate {
  id: string;
  documentType: TemplateDocument;
  variant: TemplateVariant;
  name: string;
  body: string;
  isDefault: boolean;
  updatedAt: string;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  letterheadMode: 'BUILT_IN',
  headerImageUrl: null,
  footerImageUrl: null,
  pageImageUrl: null,
  marginTopMm: 14,
  marginBottomMm: 16,
  marginSideMm: 16,
  signatoryName: null,
  signatoryTitle: null,
  signature: null,
  stamp: null,
  sealDocuments: [],
};

/** Falls back to the platform's letterhead so a print never fails on it. */
export const getPrintSettings = cache(async (): Promise<PrintSettings> => {
  const res = await safe(api.get<PrintSettings>('/company/print-settings'));
  return res.data ?? DEFAULT_PRINT_SETTINGS;
});

export const getDocumentTemplates = cache(async (documentType: TemplateDocument): Promise<DocumentTemplate[]> => {
  const res = await safe(api.get<DocumentTemplate[]>(`/document-templates?documentType=${documentType}`));
  return res.data ?? [];
});

/**
 * The template a document prints with: the one asked for (?template=), else
 * the default for its sale type, else the default for any sale. `none` prints
 * without wording.
 */
export function pickTemplate(
  templates: DocumentTemplate[],
  variant: Exclude<TemplateVariant, 'ANY'> | null,
  requested?: string,
): DocumentTemplate | null {
  if (requested === 'none') return null;
  if (requested) {
    const asked = templates.find((t) => t.id === requested);
    if (asked) return asked;
  }
  return (
    (variant && templates.find((t) => t.variant === variant && t.isDefault)) ||
    templates.find((t) => t.variant === 'ANY' && t.isDefault) ||
    (variant && templates.find((t) => t.variant === variant)) ||
    templates.find((t) => t.variant === 'ANY') ||
    null
  );
}

/** The signature and stamp a document carries, when the company puts them on it. */
export function sealFor(settings: PrintSettings, doc: SealDocument, final: boolean) {
  if (!final || !settings.sealDocuments.includes(doc)) return null;
  if (!settings.signature && !settings.stamp) return null;
  return {
    signature: settings.signature,
    stamp: settings.stamp,
    name: settings.signatoryName,
    title: settings.signatoryTitle,
  };
}
export type Seal = NonNullable<ReturnType<typeof sealFor>>;
