/**
 * Deterministic parsing of contact details and conversational answers for the
 * lead-capture flows: phone, name, consent yes/no, a preferred date, and a
 * "choose result N" index. Pure functions, no I/O. Intentionally simple — when
 * a value can't be parsed confidently we return undefined and the engine asks
 * the user directly rather than guessing.
 */

import { foldDigits, normalizeArabic } from './normalize';

/** Project phone rule (mirrors auth.dto E.164): optional +, no leading 0, 8–15 digits. */
export const E164 = /^\+?[1-9]\d{7,14}$/;

const CONSENT_YES = ['نعم', 'موافق', 'اوافق', 'تمام', 'ماشي', 'اه', 'ايوه', 'اكيد', 'حاضر', 'ok', 'okay', 'yes', 'y'];
const CONSENT_NO = ['لا', 'لاء', 'مش موافق', 'رافض', 'مش عايز', 'no', 'n'];

const CANCEL_WORDS = ['الغاء', 'إلغاء', 'الغي', 'cancel', 'بطل', 'رجوع', 'انسى', 'مش عايز اكمل'];

/**
 * Normalize a phone toward E.164 then validate. Handles Egyptian local form
 * (01XXXXXXXXX → +20...) and a 00 international prefix. Returns the validated
 * E.164 string or undefined.
 */
export function parsePhone(raw: string): string | undefined {
  const digitsSource = foldDigits(raw);
  // Grab the first phone-like run: optional +, then 7+ digits/separators.
  const m = digitsSource.match(/\+?\d[\d\s().-]{6,}\d/);
  if (!m) return undefined;
  let v = m[0].replace(/[\s().-]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  // Egyptian local mobile: 01XXXXXXXXX (11 digits) → +20 1XXXXXXXXX
  if (/^0\d{10}$/.test(v)) v = `+20${v.slice(1)}`;
  return E164.test(v) ? v : undefined;
}

/**
 * Extract a name. Prefers an explicit "اسمي … / انا …" prefix; otherwise, when
 * we're directly asking for the name, accepts a short digit-free phrase.
 */
export function parseName(raw: string, askingDirectly = false): string | undefined {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const prefix = normalizeArabic(trimmed).match(/(?:اسمي|انا|اسمى|my name is|i am|im)\s+(.+)/);
  if (prefix) {
    // Re-extract from the original (non-normalized) text to keep proper spelling.
    const idx = trimmed.search(/(?:اسمي|انا|اسمى|my name is|i am|im)\s+/i);
    const after = idx >= 0 ? trimmed.slice(idx).replace(/^\S+\s+/, '') : (prefix[1] ?? '');
    return cleanName(after);
  }
  if (askingDirectly) return cleanName(trimmed);
  return undefined;
}

function cleanName(value: string): string | undefined {
  const name = value.trim().split(/\s+/).slice(0, 4).join(' ');
  if (name.length < 2 || name.length > 60) return undefined;
  if (/\d/.test(name)) return undefined; // a number isn't a name
  return name;
}

export type Consent = 'yes' | 'no' | 'unclear';

export function parseConsent(norm: string): Consent {
  if (CONSENT_NO.some((w) => norm === w || norm.startsWith(`${w} `) || norm.includes(` ${w}`))) return 'no';
  if (CONSENT_YES.some((w) => norm === w || norm.includes(w))) return 'yes';
  return 'unclear';
}

export function isCancel(norm: string): boolean {
  return CANCEL_WORDS.some((w) => norm.includes(w));
}

/**
 * Parse a preferred visit date into an ISO string. Understands relative Arabic
 * (اليوم/بكرة/بعد بكرة) and explicit YYYY-MM-DD or DD/MM/YYYY. Returns undefined
 * when it can't parse confidently (engine then re-asks with a format hint).
 */
export function parsePreferredDate(raw: string, now: Date = new Date()): string | undefined {
  const norm = normalizeArabic(raw);
  const atNoon = (d: Date) => {
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };
  const addDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return atNoon(d);
  };
  if (/بعد بكره|بعد غدا|بعد غد/.test(norm)) return addDays(2);
  if (/بكره|غدا|غدًا|غد/.test(norm)) return addDays(1);
  if (/النهارده|اليوم|انهارده/.test(norm)) return addDays(0);

  const folded = foldDigits(raw);
  const iso = folded.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), atNoon);
  const dmy = folded.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return buildDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), atNoon);
  return undefined;
}

function buildDate(y: number, m: number, d: number, fmt: (date: Date) => string): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return undefined; // rejects 31/02 etc.
  return fmt(date);
}

/** Parse a 1-based choice ("2", "الأول", "التاني") into a 0-based index, bounded by `count`. */
export function parseChoiceIndex(raw: string, count: number): number | undefined {
  const norm = normalizeArabic(foldDigits(raw));
  const ordinals: Array<[RegExp, number]> = [
    [/الاول|اول|الاولي/, 0],
    [/التاني|الثاني|تاني/, 1],
    [/التالت|الثالث|تالت/, 2],
    [/الرابع|رابع/, 3],
    [/الخامس|خامس/, 4],
  ];
  for (const [re, idx] of ordinals) {
    if (re.test(norm) && idx < count) return idx;
  }
  const num = norm.match(/\b(\d{1,2})\b/);
  if (num) {
    const i = Number(num[1]) - 1;
    if (i >= 0 && i < count) return i;
  }
  return undefined;
}
