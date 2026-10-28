import type { Locale } from '@/lib/locale';

/* «العملاء المكررون» — one customer with more than one open lead. Strings only. */
const ar = {
  open: 'المكررة',
  eyebrow: 'المبيعات',
  title: 'فرص مكررة',
  desc: 'نفس العميل له أكثر من فرصة مفتوحة. اختر الفرصة التي تبقى، وتُدمج فيها الأخرى بكل ملاحظاتها وسجلها.',
  back: 'فرص المبيعات',
  count: (n: number) => (n === 1 ? 'عميل واحد مكرر' : `${n} عملاء مكررين`),
  leadsOf: (n: number) => `${n} فرص مفتوحة`,
  keep: 'تبقى',
  merge: 'تُدمج',
  owner: 'المسؤول',
  unassigned: 'غير مسند',
  created: 'أُضيفت',
  notes: (n: number) => `${n} نشاط`,
  locked: 'فيها حجز أو وسيط — لا تُدمج، اجعلها هي التي تبقى',
  mergeBtn: (n: number) => `دمج ${n} في الفرصة المختارة`,
  merging: 'جارٍ الدمج…',
  merged: 'تم الدمج',
  confirm: 'دمج الفرص المختارة في الفرصة التي تبقى؟ تنتقل ملاحظاتها وسجلها، ثم تُحذف.',
  empty: 'لا توجد فرص مكررة',
  emptyDesc: 'كل عميل له فرصة مفتوحة واحدة.',
  how: 'عند الدمج: تنتقل الملاحظات والمكالمات والاستفسارات والزيارات إلى الفرصة التي تبقى، وتأخذ منها ما ينقصها (الحملة، المصدر، المشروع، المسؤول، المتابعة القادمة) وأبعد مرحلة وصلت إليها.',
  error: 'تعذّر الدمج',
};

const en: typeof ar = {
  open: 'Duplicates',
  eyebrow: 'Sales',
  title: 'Duplicate leads',
  desc: 'The same customer has more than one open lead. Pick the one to keep; the others merge into it with their notes and history.',
  back: 'Sales leads',
  count: (n: number) => `${n} duplicated customer${n === 1 ? '' : 's'}`,
  leadsOf: (n: number) => `${n} open leads`,
  keep: 'Keep',
  merge: 'Merge',
  owner: 'Owner',
  unassigned: 'Unassigned',
  created: 'Added',
  notes: (n: number) => `${n} activities`,
  locked: 'Has a reservation or a broker — keep this one instead',
  mergeBtn: (n: number) => `Merge ${n} into the kept lead`,
  merging: 'Merging…',
  merged: 'Merged',
  confirm: 'Merge the chosen leads into the kept one? Their notes and history move over, then they are removed.',
  empty: 'No duplicate leads',
  emptyDesc: 'Every customer has a single open lead.',
  how: 'On merge, notes, calls, inquiries and visits move to the kept lead; it takes what it lacks from the others (campaign, source, project, owner, next follow-up) and the furthest stage reached.',
  error: 'Could not merge',
};

export function duplicateT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
export type DuplicateMessages = typeof ar;
