/**
 * The booking form a customer signs online, laid out here from the booking
 * and the company's wording so every client (the dashboard, the staff app)
 * sends the same document. Read by the public website (web-public), so the
 * shape is versioned.
 *
 * Ported from the dashboard's printing code (web-admin `lib/sign-snapshot.ts`,
 * `document-template.ts`, `document-values.ts`, `form-layout.ts`,
 * `customer-fields.ts`, `messages/print.ts`): the printed booking form and
 * the signed one read alike. A change to how a booking form prints belongs
 * in both places.
 *
 * Inputs are the API's JSON (Decimals as strings, dates as ISO strings), as
 * the dashboard reads them.
 */

export type Locale = 'ar' | 'en';
type Translatable = { ar: string; en: string };
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ── Formatting ───────────────────────────────────────────────────────────────

const INTL: Record<Locale, string> = { ar: 'ar-EG-u-nu-latn', en: 'en-EG' };

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = 'ar',
  timeZone?: string,
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(INTL[locale], { dateStyle: 'medium', timeZone }).format(d);
}

export function tx(value: Translatable | string | null | undefined, locale: Locale = 'ar'): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ar || '—';
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
  locale: Locale,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  const digits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat(locale === 'en' ? 'en-EG' : 'ar-EG-u-nu-latn', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** As the dashboard: a number (or a Decimal string, which reads as it is). */
export function formatNumber(value: number | string, locale: Locale): string {
  return value.toLocaleString(locale === 'en' ? 'en-EG' : 'ar-EG-u-nu-latn');
}

// ── Wording ──────────────────────────────────────────────────────────────────

const M = {
  ar: {
    fallbackCompany: 'الشركة',
    months: (n: number) => `${n.toLocaleString('ar-EG-u-nu-latn')} شهر`,
    sqm: 'م²',
    clauses: 'البنود والشروط',
    title: 'نموذج حجز وحدة عقارية',
    eyebrow: 'حجز',
    client: 'بيانات العميل',
    unit: 'الوحدة المحجوزة',
    details: 'بيانات الحجز',
    fields: {
      name: 'الاسم',
      phone: 'الهاتف',
      nationalId: 'الرقم القومي',
      address: 'العنوان',
      project: 'المشروع',
      building: 'المبنى',
      unitCode: 'كود الوحدة',
      unitType: 'نوع الوحدة',
      area: 'المساحة',
      floor: 'الطابق',
      reservationNumber: 'رقم الحجز',
      createdAt: 'تاريخ الحجز',
      expiresAt: 'صالح حتى',
    },
    amounts: {
      booking: 'مبلغ الحجز (العربون)',
      downPayment: 'الدفعة الأولى',
      financed: 'المبلغ المموَّل',
      duration: 'مدة السداد',
      monthly: 'القسط الشهري',
      balloon: (n: number) => `دفعة كل ${n.toLocaleString('ar-EG-u-nu-latn')} أشهر`,
      total: 'إجمالي المبلغ المستحق',
    },
  },
  en: {
    fallbackCompany: 'The company',
    months: (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`,
    sqm: 'm²',
    clauses: 'Terms and conditions',
    title: 'Unit Reservation Form',
    eyebrow: 'Reservation',
    client: 'Client',
    unit: 'Reserved unit',
    details: 'Reservation details',
    fields: {
      name: 'Name',
      phone: 'Phone',
      nationalId: 'National ID',
      address: 'Address',
      project: 'Project',
      building: 'Building',
      unitCode: 'Unit code',
      unitType: 'Unit type',
      area: 'Area',
      floor: 'Floor',
      reservationNumber: 'Reservation no.',
      createdAt: 'Reserved on',
      expiresAt: 'Valid until',
    },
    amounts: {
      booking: 'Booking deposit',
      downPayment: 'Down payment',
      financed: 'Financed amount',
      duration: 'Payment term',
      monthly: 'Monthly installment',
      balloon: (n: number) => `Payment every ${n} months`,
      total: 'Total payable',
    },
  },
} as const;

// ── Template ─────────────────────────────────────────────────────────────────

export type TemplateValues = Partial<Record<string, string | null | undefined>>;
export type TemplateBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; lines: string[] };

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
export const BLANK = '…………………';
const customPlaceholder = (key: string) => `custom.${key}`;

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
const MINOR: Record<string, number> = { KWD: 1000, BHD: 1000, OMR: 1000, JOD: 1000 };

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];
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
      parts.push(
        o ? `${AR_ONES[o]} و${AR_TENS[Math.floor(rest / 10)]}` : AR_TENS[Math.floor(rest / 10)]!,
      );
    }
  }
  return parts.join(' و');
}

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

const EN_ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];
const EN_SCALES = ['', 'thousand', 'million', 'billion'];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (rest) {
    parts.push(
      rest < 20
        ? EN_ONES[rest]!
        : `${EN_TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${EN_ONES[rest % 10]}` : ''}`,
    );
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

/** "فقط مليون وخمسمائة ألف جنيه مصري لا غير" / "Only one million … Egyptian pounds". */
export function amountInWords(
  value: number | string | null | undefined,
  currency: string,
  locale: Locale,
): string | null {
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

// ── Company paper form ───────────────────────────────────────────────────────

export interface FormField {
  id: string;
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
export interface FilledField extends FormField {
  text?: string;
  image?: string | null;
}
export interface FormLayout {
  id: string;
  pages: { imageUrl: string }[];
  fields: FormField[];
  isDefault: boolean;
}

const SIGN_KEYS = ['sign.customer', 'sign.company', 'sign.stamp'];

/** Each text box filled; signature boxes empty (the company's never go to the public page). */
export function fillForm(
  layout: Pick<FormLayout, 'fields'>,
  values: TemplateValues,
): FilledField[] {
  return layout.fields.map((f) =>
    SIGN_KEYS.includes(f.key) ? { ...f, image: null } : { ...f, text: values[f.key] || '' },
  );
}

// ── Values ───────────────────────────────────────────────────────────────────

export interface Letterhead {
  name: string;
  displayName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  contactPhone?: string;
  contactAddress?: unknown;
  registrationNumber?: string;
  currency: string;
}
export interface PaperSettings {
  signatoryName: string | null;
  signatoryTitle: string | null;
}
export interface CustomerFieldDef {
  key: string;
  label: Translatable;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  active: boolean;
}
export interface DocumentTemplate {
  id: string;
  variant: 'ANY' | 'CASH' | 'INSTALLMENT';
  body: string;
  isDefault: boolean;
}

const FIXED_DETAILS = [
  { key: 'birthDate', placeholder: 'customer.birthDate', date: true },
  { key: 'birthPlace', placeholder: 'customer.birthPlace' },
  { key: 'occupation', placeholder: 'customer.occupation' },
  { key: 'employer', placeholder: 'customer.employer' },
  { key: 'nationalIdIssueDate', placeholder: 'customer.idIssueDate', date: true },
  { key: 'nationalIdIssuePlace', placeholder: 'customer.idIssuePlace' },
  { key: 'homePhone', placeholder: 'customer.homePhone' },
] as const;

/** A day stored at UTC midnight, read in UTC. */
function formatDay(v: string | null | undefined, locale: Locale): string | null {
  return v ? formatDate(v.slice(0, 10), locale, 'UTC') : null;
}

function customValueText(
  f: CustomerFieldDef,
  v: string | number | undefined,
  locale: Locale,
): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (f.type === 'NUMBER') return new Intl.NumberFormat(INTL[locale]).format(Number(v));
  if (f.type === 'DATE') return formatDay(String(v), locale);
  return String(v);
}

const companyNameOf = (l: Letterhead, locale: Locale) =>
  l.displayName || l.name || M[locale].fallbackCompany;

/** A booking's placeholder values (the same as on its printed form). */
export function reservationValues(
  r: Json,
  letterhead: Letterhead,
  paper: PaperSettings,
  locale: Locale,
  fields: CustomerFieldDef[] = [],
  now: Date = new Date(),
): TemplateValues {
  const address = letterhead.contactAddress;
  const c = r.client as Json | null | undefined;
  const out: TemplateValues = {
    'company.name': companyNameOf(letterhead, locale),
    'company.registration': letterhead.registrationNumber,
    'company.address':
      typeof address === 'string'
        ? address
        : address && typeof address === 'object' && 'ar' in address
          ? tx(address as Translatable, locale)
          : null,
    'company.phone': letterhead.contactPhone,
    'company.signatory': paper.signatoryName,
    'company.signatoryTitle': paper.signatoryTitle,
    today: formatDate(now, locale),
    'customer.name': r.client?.fullName ?? r.lead?.fullName,
    'customer.phone': r.client?.phone ?? r.lead?.phone,
    'customer.email': r.client?.email ?? r.lead?.email,
    'customer.nationalId': c?.nationalId,
    'customer.address': c?.address,
  };
  for (const d of FIXED_DETAILS) {
    const v = c?.[d.key] as string | null | undefined;
    out[d.placeholder] = 'date' in d && d.date ? formatDay(v, locale) : v;
  }
  for (const f of fields)
    out[customPlaceholder(f.key)] = customValueText(f, c?.customFields?.[f.key], locale);
  const unit = r.unit as Json | null | undefined;
  const building = unit?.building;
  const project = building?.phase?.project;
  return {
    ...out,
    'unit.code': unit?.code,
    'unit.type': unit?.type,
    'unit.area': unit?.area != null ? formatNumber(unit.area, locale) : null,
    'unit.floor': unit?.floor != null ? formatNumber(unit.floor, locale) : null,
    'unit.building': building ? tx(building.name, locale) : null,
    'unit.project': project ? tx(project.name, locale) : null,
    'reservation.number': r.reservationNumber,
    'reservation.date': formatDate(r.createdAt, locale),
    'reservation.amount': formatMoney(r.bookingAmount, letterhead.currency, locale),
    'reservation.amountWords': amountInWords(r.bookingAmount, letterhead.currency, locale),
    'reservation.expiresAt': formatDate(r.expiresAt, locale),
  };
}

/** The booking wording: the default for any sale, else any (a booking has no sale type yet). */
export function pickTemplate(templates: DocumentTemplate[]): DocumentTemplate | null {
  return (
    templates.find((t) => t.variant === 'ANY' && t.isDefault) ||
    templates.find((t) => t.variant === 'ANY') ||
    null
  );
}

export const pickForm = (layouts: FormLayout[]): FormLayout | null =>
  layouts.find((l) => l.isDefault) ?? null;

// ── The document ─────────────────────────────────────────────────────────────

export interface SignSnapshot {
  version: 1;
  locale: Locale;
  company: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    registration: string | null;
    phone: string | null;
  };
  eyebrow: string;
  title: string;
  reference: string | null;
  date: string;
  sections: { title: string; rows: { label: string; value: string }[] }[];
  amounts: { label: string; value: string; emphasis?: boolean }[];
  clausesTitle: string;
  clauses: TemplateBlock[];
  form?: { pages: { imageUrl: string }[]; fields: FilledField[] };
}

const present = (rows: { label: string; value: string | null | undefined | false }[]) =>
  rows.filter((r): r is { label: string; value: string } => !!r.value);

/** A booking form for the customer's signature. */
export function reservationSnapshot(
  r: Json,
  letterhead: Letterhead,
  paper: PaperSettings,
  template: DocumentTemplate | null,
  locale: Locale,
  fields: CustomerFieldDef[] = [],
  form: FormLayout | null = null,
  now: Date = new Date(),
): SignSnapshot {
  const values = reservationValues(r, letterhead, paper, locale, fields, now);
  const m = M[locale];
  const money = (v: string | number | null | undefined) =>
    formatMoney(v, letterhead.currency, locale);
  const building = r.unit?.building;
  const project = building?.phase?.project;
  return {
    version: 1,
    locale,
    company: {
      name: companyNameOf(letterhead, locale),
      logoUrl: letterhead.logoUrl ?? null,
      primaryColor: letterhead.primaryColor ?? null,
      accentColor: letterhead.accentColor ?? null,
      registration: letterhead.registrationNumber ?? null,
      phone: letterhead.contactPhone ?? null,
    },
    eyebrow: m.eyebrow,
    title: m.title,
    reference: r.reservationNumber,
    date: formatDate(r.createdAt, locale),
    sections: [
      {
        title: m.client,
        rows: present([
          { label: m.fields.name, value: r.client?.fullName ?? r.lead?.fullName },
          { label: m.fields.nationalId, value: r.client?.nationalId },
          { label: m.fields.phone, value: r.client?.phone ?? r.lead?.phone },
          { label: m.fields.address, value: r.client?.address },
        ]),
      },
      {
        title: m.unit,
        rows: present([
          { label: m.fields.project, value: project ? tx(project.name, locale) : null },
          { label: m.fields.building, value: building ? tx(building.name, locale) : null },
          { label: m.fields.unitCode, value: r.unit?.code },
          { label: m.fields.unitType, value: r.unit?.type },
          {
            label: m.fields.area,
            value: r.unit?.area != null ? `${formatNumber(r.unit.area, locale)} ${m.sqm}` : null,
          },
          {
            label: m.fields.floor,
            value: r.unit?.floor != null ? formatNumber(r.unit.floor, locale) : null,
          },
        ]),
      },
      {
        title: m.details,
        rows: present([
          { label: m.fields.reservationNumber, value: r.reservationNumber },
          { label: m.fields.createdAt, value: formatDate(r.createdAt, locale) },
          { label: m.fields.expiresAt, value: formatDate(r.expiresAt, locale) },
        ]),
      },
    ],
    amounts: [
      { label: m.amounts.booking, value: money(r.bookingAmount), emphasis: true },
      ...present([
        {
          label: m.amounts.downPayment,
          value: r.snapshotDownPaymentAmount != null ? money(r.snapshotDownPaymentAmount) : null,
        },
        {
          label: m.amounts.financed,
          value: r.snapshotFinancedAmount != null ? money(r.snapshotFinancedAmount) : null,
        },
        {
          label: m.amounts.duration,
          value: r.selectedDurationMonths != null ? m.months(r.selectedDurationMonths) : null,
        },
        {
          label: m.amounts.monthly,
          value: r.snapshotMonthlyInstallment != null ? money(r.snapshotMonthlyInstallment) : null,
        },
        // Balloon plan: the big payment beside the monthly one.
        {
          label: m.amounts.balloon(Number(r.snapshotBalloonEveryMonths ?? 0)),
          value: r.snapshotBalloonAmount != null && r.snapshotBalloonEveryMonths ? money(r.snapshotBalloonAmount) : null,
        },
        {
          label: m.amounts.total,
          value: r.snapshotTotalPayable != null ? money(r.snapshotTotalPayable) : null,
        },
      ]),
    ],
    clausesTitle: m.clauses,
    clauses: template ? renderTemplate(template.body, values) : [],
    ...(form ? { form: { pages: form.pages, fields: fillForm(form, values) } } : {}),
  };
}
