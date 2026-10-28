import { LeadCallResult, LeadNoteKind, LeadStage, ProjectStatus } from '@prisma/client';

/**
 * Words other systems use for the values this one keeps as fixed lists.
 * Matching ignores case, spaces, dashes and underscores, and Arabic letter
 * forms (أ/إ/آ → ا, ة → ه, ى → ي). A word not here is kept on the record for
 * the platform owner to map — never guessed.
 */
export function normalizeWord(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s_\-.]+/g, '');
}

function table<T extends string>(entries: Record<T, string[]>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [value, words] of Object.entries(entries) as [T, string[]][]) {
    for (const w of [value, ...words]) map.set(normalizeWord(w), value);
  }
  return map;
}

const STAGES = table<LeadStage>({
  NEW: ['new', 'fresh', 'open', 'جديد', 'عميل جديد'],
  INTERESTED: ['interested', 'qualified', 'warm', 'hot', 'مهتم', 'مؤهل'],
  VISIT: ['visit', 'site visit', 'visited', 'meeting', 'زياره', 'معاينه'],
  NEGOTIATION: ['negotiation', 'negotiating', 'proposal', 'offer', 'تفاوض', 'عرض سعر'],
  WON: ['won', 'closed won', 'deal', 'sold', 'converted', 'تم البيع', 'مكسوب', 'تعاقد'],
  LOST: ['lost', 'closed lost', 'not interested', 'junk', 'خساره', 'مفقود', 'غير مهتم'],
});

const NOTE_KINDS = table<LeadNoteKind>({
  NOTE: ['note', 'comment', 'ملاحظه', 'تعليق'],
  CALL: ['call', 'phone', 'phone call', 'مكالمه', 'اتصال'],
  MEETING: ['meeting', 'visit', 'اجتماع', 'مقابله', 'زياره'],
  WHATSAPP: ['whatsapp', 'whats app', 'wa', 'واتساب', 'واتس', 'واتس اب'],
  FOLLOW_UP: ['follow up', 'followup', 'task', 'reminder', 'متابعه', 'تذكير'],
});

const CALL_RESULTS = table<LeadCallResult>({
  ANSWERED: ['answered', 'reached', 'connected', 'رد', 'تم الرد'],
  NO_ANSWER: ['no answer', 'not answered', 'missed', 'لم يرد', 'مردش', 'لا يرد'],
  BUSY: ['busy', 'مشغول'],
  UNREACHABLE: ['unreachable', 'switched off', 'closed', 'غير متاح', 'مغلق', 'مقفول'],
  WRONG_NUMBER: ['wrong number', 'invalid number', 'رقم خطا', 'رقم غلط'],
});

const PROJECT_STATUSES = table<ProjectStatus>({
  DRAFT: ['draft', 'hidden', 'مسوده', 'مخفي'],
  PUBLISHED: ['published', 'active', 'live', 'منشور', 'نشط'],
  ARCHIVED: ['archived', 'closed', 'inactive', 'مؤرشف', 'مغلق'],
});

/** A unit's status: free to sell, or sold / booked in the other system. */
const UNIT_STATUSES = table<'AVAILABLE' | 'TAKEN'>({
  AVAILABLE: ['available', 'free', 'open', 'for sale', 'متاح', 'متاحه', 'فاضي'],
  TAKEN: ['sold', 'reserved', 'booked', 'hold', 'contracted', 'RESERVED', 'SOLD', 'مباع', 'مباعه', 'محجوز', 'محجوزه', 'متعاقد'],
});

const lookup = <T>(map: Map<string, T>) => (raw: string | undefined | null): T | undefined =>
  raw ? map.get(normalizeWord(raw)) : undefined;

export const leadStageOf = lookup(STAGES);
export const noteKindOf = lookup(NOTE_KINDS);
export const callResultOf = lookup(CALL_RESULTS);
export const projectStatusOf = lookup(PROJECT_STATUSES);
export const unitStatusOf = lookup(UNIT_STATUSES);
