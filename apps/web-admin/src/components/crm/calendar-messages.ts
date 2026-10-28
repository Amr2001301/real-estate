import type { Locale } from '@/lib/locale';

type Counts = Record<'visit' | 'follow_up' | 'done' | 'reservation_expiry' | 'contract_signed', number>;

/* «التقويم» — a rep's or a team's visits, follow-ups, logged calls, reservation expiries and contract signings. Strings only. */
const ar = {
  eyebrow: 'المبيعات',
  title: 'التقويم',
  desc: 'زيارات العملاء، والمتابعات المستحقة، والمكالمات التي سُجّلت، وانتهاء الحجوزات، وتوقيع العقود — شهرًا بشهر.',
  today: 'اليوم',
  prev: 'الشهر السابق',
  next: 'الشهر التالي',
  rep: 'المندوب',
  everyone: 'الكل',
  apply: 'عرض',
  weekdays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
  more: (n: number) => `+${n} أخرى`,
  legend: { visit: 'زيارة', follow_up: 'متابعة مستحقة', done: 'نشاط مُسجَّل', reservation_expiry: 'انتهاء حجز', contract_signed: 'توقيع عقد' },
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
  reservationExpiry: 'ينتهي الحجز',
  reservationExpired: 'انتهى الحجز',
  contractSigned: 'توقيع عقد',
  unit: 'وحدة',
  summary: (c: Counts) =>
    [`${c.visit} زيارة`, `${c.follow_up} متابعة`, `${c.done} نشاط مُسجَّل`, c.reservation_expiry && `${c.reservation_expiry} حجز ينتهي`, c.contract_signed && `${c.contract_signed} عقد`]
      .filter(Boolean)
      .join(' · '),
  error: 'تعذّر تحميل التقويم',
};

const en: typeof ar = {
  eyebrow: 'Sales',
  title: 'Calendar',
  desc: 'Customer visits, follow-ups due, calls logged, reservations running out and contracts signed — month by month.',
  today: 'Today',
  prev: 'Previous month',
  next: 'Next month',
  rep: 'Rep',
  everyone: 'Everyone',
  apply: 'Show',
  weekdays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  more: (n: number) => `+${n} more`,
  legend: { visit: 'Visit', follow_up: 'Follow-up due', done: 'Logged activity', reservation_expiry: 'Reservation expiry', contract_signed: 'Contract signed' },
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
  reservationExpiry: 'Reservation expires',
  reservationExpired: 'Reservation expired',
  contractSigned: 'Contract signed',
  unit: 'Unit',
  summary: (c: Counts) =>
    [`${c.visit} visits`, `${c.follow_up} follow-ups`, `${c.done} logged`, c.reservation_expiry && `${c.reservation_expiry} expiring`, c.contract_signed && `${c.contract_signed} contracts`]
      .filter(Boolean)
      .join(' · '),
  error: 'Could not load the calendar',
};

export function calendarT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
