import type { Locale } from '@/lib/locale';

// Contract page — the unit handover (warranties and maintenance start there).

const ar = {
  title: 'تسليم الوحدة',
  notYet: 'لم تُسلَّم الوحدة بعد. يبدأ الضمان وتُفتح طلبات صيانة العميل من تاريخ التسليم.',
  notSigned: 'يُسجَّل التسليم بعد توقيع العقد.',
  handedOverAt: 'تاريخ التسليم',
  checklist: 'قائمة التسليم',
  notes: 'ملاحظات',
  record: 'تسجيل التسليم',
  recording: 'جارٍ التسجيل…',
  backfilled: 'سُجِّل قبل تتبّع التسليم (تاريخ إنشاء العقد).',
  confirm: (date: string, checked: number, total: number) =>
    `تسجيل تسليم الوحدة بتاريخ ${date} (${checked} من ${total} بنود القائمة)؟ يبدأ الضمان من هذا التاريخ ولا يمكن التراجع.`,
  unpaid: (amount: string) => `ما زال على العقد ${amount} غير مسدَّد.`,
  items: {
    keys: 'تسليم المفاتيح',
    meters: 'قراءة العدادات',
    inspection: 'معاينة الوحدة مع العميل',
    snags: 'تسجيل الملاحظات والعيوب',
    documents: 'تسليم المستندات',
  } as Record<string, string>,
};

const en: typeof ar = {
  title: 'Unit handover',
  notYet: 'Not handed over yet. The warranty starts and the customer’s maintenance requests open from the handover date.',
  notSigned: 'The handover is recorded once the contract is signed.',
  handedOverAt: 'Handover date',
  checklist: 'Handover checklist',
  notes: 'Notes',
  record: 'Record handover',
  recording: 'Recording…',
  backfilled: 'Recorded before handovers were tracked (the contract’s creation date).',
  confirm: (date: string, checked: number, total: number) =>
    `Record the handover on ${date} (${checked} of ${total} checklist items)? The warranty starts from this date; it can't be undone.`,
  unpaid: (amount: string) => `${amount} is still unpaid on this contract.`,
  items: {
    keys: 'Keys handed over',
    meters: 'Meter readings taken',
    inspection: 'Unit inspected with the customer',
    snags: 'Snags recorded',
    documents: 'Documents handed over',
  },
};

export function handoverT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export const HANDOVER_CHECKLIST_KEYS = ['keys', 'meters', 'inspection', 'snags', 'documents'] as const;
