import type { TemplateDocument } from './print-settings';

/**
 * A document template's wording: plain text with {{placeholders}} filled from
 * the record when it prints. A line that starts with "## " is a clause
 * heading; a blank line starts a new paragraph. A placeholder with no value
 * prints as a dotted blank to fill by hand.
 */

/** A document a value can be filled on: a wording's, or a receipt (on the company's own paper). */
export type PlaceholderDocument = TemplateDocument | 'RECEIPT';

export interface Placeholder {
  key: string;
  ar: string;
  en: string;
  /** The documents it is filled on. */
  docs: PlaceholderDocument[];
}

const ALL: PlaceholderDocument[] = ['CONTRACT', 'RESERVATION', 'RECEIPT'];
const CONTRACT: PlaceholderDocument[] = ['CONTRACT'];
const RESERVATION: PlaceholderDocument[] = ['RESERVATION'];
const RECEIPT: PlaceholderDocument[] = ['RECEIPT'];

export const PLACEHOLDER_GROUPS: { ar: string; en: string; items: Placeholder[] }[] = [
  {
    ar: 'الشركة',
    en: 'Company',
    items: [
      { key: 'company.name', ar: 'اسم الشركة', en: 'Company name', docs: ALL },
      { key: 'company.registration', ar: 'رقم السجل التجاري', en: 'Commercial registration', docs: ALL },
      { key: 'company.address', ar: 'عنوان الشركة', en: 'Company address', docs: ALL },
      { key: 'company.phone', ar: 'هاتف الشركة', en: 'Company phone', docs: ALL },
      { key: 'company.signatory', ar: 'اسم المفوض بالتوقيع', en: 'Authorised signatory', docs: ALL },
      { key: 'company.signatoryTitle', ar: 'صفة المفوض بالتوقيع', en: 'Signatory’s title', docs: ALL },
    ],
  },
  {
    ar: 'العميل',
    en: 'Customer',
    items: [
      { key: 'customer.name', ar: 'اسم العميل', en: 'Customer name', docs: ALL },
      { key: 'customer.phone', ar: 'هاتف العميل', en: 'Customer phone', docs: ALL },
      { key: 'customer.email', ar: 'بريد العميل', en: 'Customer e-mail', docs: ALL },
      { key: 'customer.nationalId', ar: 'الرقم القومي', en: 'National ID', docs: ALL },
      { key: 'customer.address', ar: 'عنوان العميل', en: 'Customer address', docs: ALL },
      { key: 'customer.birthDate', ar: 'تاريخ الميلاد', en: 'Date of birth', docs: ALL },
      { key: 'customer.birthPlace', ar: 'محل الميلاد', en: 'Place of birth', docs: ALL },
      { key: 'customer.occupation', ar: 'الوظيفة / المهنة', en: 'Occupation', docs: ALL },
      { key: 'customer.employer', ar: 'جهة العمل', en: 'Employer', docs: ALL },
      { key: 'customer.idIssueDate', ar: 'تاريخ إصدار الهوية', en: 'ID issue date', docs: ALL },
      { key: 'customer.idIssuePlace', ar: 'جهة إصدار الهوية', en: 'ID issued at', docs: ALL },
      { key: 'customer.homePhone', ar: 'التليفون الأرضي', en: 'Home phone', docs: ALL },
    ],
  },
  {
    ar: 'الوحدة',
    en: 'Unit',
    items: [
      { key: 'unit.code', ar: 'كود الوحدة', en: 'Unit code', docs: ALL },
      { key: 'unit.type', ar: 'نوع الوحدة', en: 'Unit type', docs: ALL },
      { key: 'unit.area', ar: 'المساحة (م²)', en: 'Area (m²)', docs: ALL },
      { key: 'unit.floor', ar: 'الدور', en: 'Floor', docs: ALL },
      { key: 'unit.building', ar: 'المبنى', en: 'Building', docs: ALL },
      { key: 'unit.project', ar: 'المشروع', en: 'Project', docs: ALL },
    ],
  },
  {
    ar: 'العقد',
    en: 'Contract',
    items: [
      { key: 'contract.number', ar: 'رقم العقد', en: 'Contract number', docs: ['CONTRACT', 'RECEIPT'] },
      { key: 'contract.date', ar: 'تاريخ العقد', en: 'Contract date', docs: CONTRACT },
      { key: 'contract.total', ar: 'قيمة العقد', en: 'Contract value', docs: CONTRACT },
      { key: 'contract.totalWords', ar: 'قيمة العقد كتابةً', en: 'Contract value in words', docs: CONTRACT },
      { key: 'contract.downPayment', ar: 'المقدم', en: 'Down payment', docs: CONTRACT },
      { key: 'contract.downPaymentWords', ar: 'المقدم كتابةً', en: 'Down payment in words', docs: CONTRACT },
      { key: 'contract.remaining', ar: 'الباقي بعد المقدم', en: 'Balance after down payment', docs: CONTRACT },
      { key: 'contract.deliveryDate', ar: 'تاريخ التسليم', en: 'Handover date', docs: CONTRACT },
    ],
  },
  {
    ar: 'التقسيط',
    en: 'Instalments',
    items: [
      { key: 'plan.count', ar: 'عدد الأقساط', en: 'Number of instalments', docs: CONTRACT },
      { key: 'plan.installment', ar: 'قيمة القسط', en: 'Instalment amount', docs: CONTRACT },
      { key: 'plan.frequency', ar: 'دورية السداد', en: 'Payment frequency', docs: CONTRACT },
      { key: 'plan.months', ar: 'مدة التقسيط (شهور)', en: 'Plan length (months)', docs: CONTRACT },
      { key: 'plan.firstDue', ar: 'تاريخ أول قسط', en: 'First instalment date', docs: CONTRACT },
      { key: 'plan.lastDue', ar: 'تاريخ آخر قسط', en: 'Last instalment date', docs: CONTRACT },
    ],
  },
  {
    ar: 'الحجز',
    en: 'Booking',
    items: [
      { key: 'reservation.number', ar: 'رقم الحجز', en: 'Booking number', docs: ALL },
      { key: 'reservation.date', ar: 'تاريخ الحجز', en: 'Booking date', docs: RESERVATION },
      { key: 'reservation.amount', ar: 'مبلغ الحجز', en: 'Booking amount', docs: RESERVATION },
      { key: 'reservation.amountWords', ar: 'مبلغ الحجز كتابةً', en: 'Booking amount in words', docs: RESERVATION },
      { key: 'reservation.expiresAt', ar: 'صلاحية الحجز حتى', en: 'Booking valid until', docs: RESERVATION },
    ],
  },
  {
    ar: 'الإيصال',
    en: 'Receipt',
    items: [
      { key: 'receipt.number', ar: 'رقم الإيصال', en: 'Receipt number', docs: RECEIPT },
      { key: 'receipt.date', ar: 'تاريخ السداد', en: 'Payment date', docs: RECEIPT },
      { key: 'receipt.amount', ar: 'المبلغ', en: 'Amount', docs: RECEIPT },
      { key: 'receipt.amountWords', ar: 'المبلغ كتابةً', en: 'Amount in words', docs: RECEIPT },
      { key: 'receipt.for', ar: 'وذلك قيمة', en: 'Paid for', docs: RECEIPT },
      { key: 'receipt.method', ar: 'طريقة الدفع', en: 'Payment method', docs: RECEIPT },
      { key: 'receipt.chequeNumber', ar: 'رقم الشيك', en: 'Cheque number', docs: RECEIPT },
      { key: 'receipt.installmentDue', ar: 'استحقاق القسط', en: 'Instalment due date', docs: RECEIPT },
    ],
  },
  {
    ar: 'عام',
    en: 'General',
    items: [{ key: 'today', ar: 'تاريخ اليوم', en: 'Today’s date', docs: ALL }],
  },
];

export const PLACEHOLDERS: Placeholder[] = PLACEHOLDER_GROUPS.flatMap((g) => g.items);
const KNOWN = new Set(PLACEHOLDERS.map((p) => p.key));

export type TemplateValues = Partial<Record<string, string | null | undefined>>;

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
export const BLANK = '…………………';

/** The placeholder of one of the company's own customer fields. */
export const customPlaceholder = (key: string) => `custom.${key}`;

/**
 * Placeholders in the text that the platform does not know (typos); the
 * company's own customer fields are given as `customKeys`.
 */
export function unknownPlaceholders(body: string, customKeys: Iterable<string> = []): string[] {
  const custom = new Set([...customKeys].map(customPlaceholder));
  const out = new Set<string>();
  for (const m of body.matchAll(TOKEN)) if (!KNOWN.has(m[1]!) && !custom.has(m[1]!)) out.add(m[1]!);
  return [...out];
}

export type TemplateBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] };

/** The wording with its values filled in, as headings and paragraphs. */
export function renderTemplate(body: string, values: TemplateValues): TemplateBlock[] {
  const fill = (line: string) =>
    line.replace(TOKEN, (_m, key: string) => {
      const v = values[key];
      return v === null || v === undefined || v === '' ? BLANK : v;
    });

  const blocks: TemplateBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', lines: para });
    para = [];
  };
  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (line.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'heading', text: fill(line.slice(3).trim()) });
    } else {
      para.push(fill(line));
    }
  }
  flush();
  return blocks;
}

// ── Amounts in words ─────────────────────────────────────────────────────────

const CURRENCY_WORDS: Record<string, { ar: [string, string]; en: [string, string] }> = {
  EGP: { ar: ['جنيه مصري', 'قرش'], en: ['Egyptian pounds', 'piastres'] },
  SAR: { ar: ['ريال سعودي', 'هللة'], en: ['Saudi riyals', 'halalas'] },
  AED: { ar: ['درهم إماراتي', 'فلس'], en: ['UAE dirhams', 'fils'] },
  KWD: { ar: ['دينار كويتي', 'فلس'], en: ['Kuwaiti dinars', 'fils'] },
  QAR: { ar: ['ريال قطري', 'درهم'], en: ['Qatari riyals', 'dirhams'] },
  BHD: { ar: ['دينار بحريني', 'فلس'], en: ['Bahraini dinars', 'fils'] },
  OMR: { ar: ['ريال عماني', 'بيسة'], en: ['Omani rials', 'baisa'] },
  JOD: { ar: ['دينار أردني', 'قرش'], en: ['Jordanian dinars', 'piastres'] },
  USD: { ar: ['دولار أمريكي', 'سنت'], en: ['US dollars', 'cents'] },
};
/** Minor units per major unit (three-decimal currencies). */
const MINOR: Record<string, number> = { KWD: 1000, BHD: 1000, OMR: 1000, JOD: 1000 };

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
/** [one, two, 3–10 plural, 11+ singular] */
const AR_SCALES: [string, string, string, string][] = [
  ['', '', '', ''],
  ['ألف', 'ألفان', 'آلاف', 'ألف'],
  ['مليون', 'مليونان', 'ملايين', 'مليون'],
  ['مليار', 'ملياران', 'مليارات', 'مليار'],
];

function arBelow1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(AR_HUNDREDS[h]!);
  if (rest) {
    if (rest < 10) parts.push(AR_ONES[rest]!);
    else if (rest < 20) parts.push(AR_TEENS[rest - 10]!);
    else {
      const o = rest % 10;
      parts.push(o ? `${AR_ONES[o]} و${AR_TENS[Math.floor(rest / 10)]}` : AR_TENS[Math.floor(rest / 10)]!);
    }
  }
  return parts.join(' و');
}

/** A whole number in Arabic words ("مليون وخمسمائة ألف"). */
export function arabicNumberWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'صفر';
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < AR_SCALES.length) {
    const g = n % 1000;
    n = Math.floor(n / 1000);
    if (g) {
      if (scale === 0) groups.unshift(arBelow1000(g));
      else {
        const [one, two, plural, many] = AR_SCALES[scale]!;
        if (g === 1) groups.unshift(one);
        else if (g === 2) groups.unshift(two);
        else if (g <= 10) groups.unshift(`${arBelow1000(g)} ${plural}`);
        else groups.unshift(`${arBelow1000(g)} ${many}`);
      }
    }
    scale++;
  }
  return groups.join(' و');
}

const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion'];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (rest) {
    parts.push(rest < 20 ? EN_ONES[rest]! : `${EN_TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${EN_ONES[rest % 10]}` : ''}`);
  }
  return parts.join(' and ');
}

export function englishNumberWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < EN_SCALES.length) {
    const g = n % 1000;
    n = Math.floor(n / 1000);
    if (g) groups.unshift(`${enBelow1000(g)}${EN_SCALES[scale] ? ` ${EN_SCALES[scale]}` : ''}`);
    scale++;
  }
  return groups.join(', ');
}

/**
 * An amount as written on contracts and receipts:
 * "فقط مليون وخمسمائة ألف جنيه مصري لا غير" / "Only one million … Egyptian pounds".
 */
export function amountInWords(value: number | string | null | undefined, currency: string, locale: 'ar' | 'en'): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.abs(Number(value));
  if (!Number.isFinite(n)) return null;
  const minorPer = MINOR[currency] ?? 100;
  const major = Math.floor(n);
  const minor = Math.round((n - major) * minorPer);
  const names = CURRENCY_WORDS[currency] ?? { ar: [currency, ''], en: [currency, ''] };
  if (locale === 'en') {
    const [maj, min] = names.en;
    const minorText = minor && min ? ` and ${englishNumberWords(minor)} ${min}` : '';
    return `Only ${englishNumberWords(major)} ${maj}${minorText}`;
  }
  const [maj, min] = names.ar;
  const minorText = minor && min ? ` و${arabicNumberWords(minor)} ${min}` : '';
  return `فقط ${arabicNumberWords(major)} ${maj}${minorText} لا غير`;
}
