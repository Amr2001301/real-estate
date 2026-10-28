import type { Locale } from '@/lib/locale';

/* «التقويم» — a rep's or a team's visits, follow-ups and logged calls. Strings only. */
const ar = {
  eyebrow: 'المبيعات',
  title: 'التقويم',
  desc: 'زيارات العملاء، والمتابعات المستحقة، والمكالمات التي سُجّلت — شهرًا بشهر.',
  today: 'اليوم',
  prev: 'الشهر السابق',
  next: 'الشهر التالي',
  rep: 'المندوب',
  everyone: 'الكل',
  apply: 'عرض',
  weekdays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
  more: (n: number) => `+${n} أخرى`,
  legend: { visit: 'زيارة', follow_up: 'متابعة مستحقة', done: 'نشاط مُسجَّل' },
  kind: { CALL: 'مكالمة', MEETING: 'اجتماع', WHATSAPP: 'واتساب', FOLLOW_UP: 'متابعة', NOTE: 'ملاحظة' } as Record<string, string>,
  visitStatus: {
    SCHEDULED: 'مجدولة',
    CONFIRMED: 'مؤكدة',
    PENDING_RESCHEDULE: 'بانتظار موعد جديد',
    COMPLETED: 'تمت',
    CANCELLED: 'ملغاة',
    NO_SHOW: 'لم يحضر',
    RESCHEDULED: 'أعيدت جدولتها',
  } as Record<string, string>,
  dayTitle: (d: string) => `يوم ${d}`,
  dayEmpty: 'لا شيء في هذا اليوم',
  visit: 'زيارة',
  followUp: 'متابعة',
  done: 'تم',
  summary: (v: number, f: number, d: number) => `${v} زيارة · ${f} متابعة · ${d} نشاط مُسجَّل`,
  error: 'تعذّر تحميل التقويم',
};

const en: typeof ar = {
  eyebrow: 'Sales',
  title: 'Calendar',
  desc: 'Customer visits, follow-ups due and calls logged — month by month.',
  today: 'Today',
  prev: 'Previous month',
  next: 'Next month',
  rep: 'Rep',
  everyone: 'Everyone',
  apply: 'Show',
  weekdays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  more: (n: number) => `+${n} more`,
  legend: { visit: 'Visit', follow_up: 'Follow-up due', done: 'Logged activity' },
  kind: { CALL: 'Call', MEETING: 'Meeting', WHATSAPP: 'WhatsApp', FOLLOW_UP: 'Follow-up', NOTE: 'Note' },
  visitStatus: {
    SCHEDULED: 'Scheduled',
    CONFIRMED: 'Confirmed',
    PENDING_RESCHEDULE: 'Awaiting a new time',
    COMPLETED: 'Done',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No show',
    RESCHEDULED: 'Rescheduled',
  },
  dayTitle: (d: string) => d,
  dayEmpty: 'Nothing on this day',
  visit: 'Visit',
  followUp: 'Follow-up',
  done: 'Done',
  summary: (v: number, f: number, d: number) => `${v} visits · ${f} follow-ups · ${d} logged`,
  error: 'Could not load the calendar',
};

export function calendarT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
