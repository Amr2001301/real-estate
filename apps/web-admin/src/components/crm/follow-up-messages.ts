import type { Locale } from '@/lib/locale';

/*
 * «المتابعات» — logging what happened with a lead (a call and how it went, a
 * meeting, a WhatsApp chat, a note) and when to follow up next. Strings only:
 * the object reaches client components.
 */
const ar = {
  kind: {
    NOTE: 'ملاحظة',
    CALL: 'مكالمة',
    MEETING: 'اجتماع',
    WHATSAPP: 'واتساب',
    FOLLOW_UP: 'متابعة',
  },
  callResult: {
    ANSWERED: 'رد',
    NO_ANSWER: 'لم يرد',
    BUSY: 'مشغول',
    UNREACHABLE: 'غير متاح',
    WRONG_NUMBER: 'رقم خاطئ',
  },
  nextType: {
    CALL: 'مكالمة',
    MEETING: 'اجتماع',
    WHATSAPP: 'رسالة واتساب',
    FOLLOW_UP: 'متابعة',
  },
  composer: {
    title: 'تسجيل نشاط',
    whatHappened: 'ماذا حدث؟',
    callResult: 'نتيجة المكالمة',
    body: 'التفاصيل',
    bodyPlaceholder: {
      NOTE: 'اكتب ملاحظة عن العميل…',
      CALL: 'ماذا قال العميل؟ ما الذي اتفقتما عليه؟',
      MEETING: 'أين كان الاجتماع وما نتيجته؟',
      WHATSAPP: 'ملخص المحادثة…',
      FOLLOW_UP: 'ما الذي تمت متابعته؟',
    },
    next: 'المتابعة القادمة',
    nextHint: 'متى ستتواصل مع العميل مرة أخرى؟ ستظهر في «المتابعات» وفي لوحة التحكم في موعدها.',
    keep: 'كما هي',
    none: 'بدون متابعة',
    tomorrow: 'غدًا',
    in3: 'بعد ٣ أيام',
    week: 'بعد أسبوع',
    pick: 'تاريخ آخر',
    date: 'التاريخ',
    time: 'الساعة',
    nextType: 'نوعها',
    nextNote: 'ملاحظة للمتابعة (اختياري)',
    nextNotePlaceholder: 'مثلاً: إرسال عرض السعر النهائي',
    save: 'حفظ النشاط',
    saving: 'جارٍ الحفظ…',
    saved: 'تم تسجيل النشاط',
    pastDate: 'اختر موعدًا في المستقبل',
    error: 'تعذّر الحفظ',
  },
  current: {
    title: 'المتابعة القادمة',
    none: 'لا توجد متابعة محددة — حدد موعدًا عند تسجيل النشاط القادم.',
    overdue: 'متأخرة',
    today: 'اليوم',
    upcoming: 'قادمة',
  },
  timeline: {
    title: 'سجل المتابعة',
    desc: 'كل مكالمة واجتماع ورسالة مع العميل، ونتيجتها، والردود عليها.',
    empty: 'لم يُسجَّل أي نشاط بعد',
    emptyDesc: 'سجّل أول مكالمة أو ملاحظة من النموذج أعلاه.',
    scheduled: 'حدد متابعة',
    reply: 'رد',
    replies: 'الردود',
    replyPlaceholder: 'اكتب ردًا…',
    send: 'إرسال',
    cancel: 'إلغاء',
    unknownAuthor: 'مستخدم',
  },
  page: {
    eyebrow: 'المبيعات',
    title: 'المتابعات',
    desc: 'العملاء الذين حان موعد التواصل معهم: المتأخر أولاً، ثم مواعيد اليوم، ثم القادم.',
    tabs: { overdue: 'متأخرة', today: 'اليوم', upcoming: 'القادمة' },
    hint: {
      overdue: 'فات موعد التواصل مع هؤلاء العملاء — ابدأ بهم.',
      today: 'مواعيد متابعة باقية اليوم.',
      upcoming: 'مواعيد بعد اليوم.',
    },
    empty: {
      overdue: 'لا توجد متابعات متأخرة — عمل رائع.',
      today: 'لا توجد متابعات باقية اليوم.',
      upcoming: 'لا توجد متابعات قادمة.',
    },
    emptyHint: 'حدد موعد المتابعة القادمة عند تسجيل أي نشاط على العميل.',
    lead: 'العميل',
    due: 'الموعد',
    action: 'المطلوب',
    last: 'آخر نشاط',
    owner: 'المسؤول',
    noActivity: 'لا يوجد نشاط',
    open: 'فتح',
    call: 'اتصال',
    whatsapp: 'واتساب',
    error: 'تعذّر تحميل المتابعات',
  },
  panel: {
    title: 'متابعات اليوم',
    desc: 'المتأخر ومواعيد اليوم',
    all: 'كل المتابعات',
    clear: 'لا متابعات متأخرة أو مستحقة اليوم.',
  },
  ago: { now: 'الآن', min: 'د', hour: 'س', day: 'ي' },
};

const en: typeof ar = {
  kind: { NOTE: 'Note', CALL: 'Call', MEETING: 'Meeting', WHATSAPP: 'WhatsApp', FOLLOW_UP: 'Follow-up' },
  callResult: {
    ANSWERED: 'Answered',
    NO_ANSWER: 'No answer',
    BUSY: 'Busy',
    UNREACHABLE: 'Unreachable',
    WRONG_NUMBER: 'Wrong number',
  },
  nextType: { CALL: 'Call', MEETING: 'Meeting', WHATSAPP: 'WhatsApp message', FOLLOW_UP: 'Follow-up' },
  composer: {
    title: 'Log an activity',
    whatHappened: 'What happened?',
    callResult: 'Call result',
    body: 'Details',
    bodyPlaceholder: {
      NOTE: 'Write a note about the customer…',
      CALL: 'What did the customer say? What did you agree on?',
      MEETING: 'Where was the meeting and how did it go?',
      WHATSAPP: 'A summary of the chat…',
      FOLLOW_UP: 'What was followed up?',
    },
    next: 'Next follow-up',
    nextHint: 'When will you contact the customer again? It shows in Follow-ups and on the dashboard when due.',
    keep: 'Keep',
    none: 'No follow-up',
    tomorrow: 'Tomorrow',
    in3: 'In 3 days',
    week: 'In a week',
    pick: 'Other date',
    date: 'Date',
    time: 'Time',
    nextType: 'Type',
    nextNote: 'Follow-up note (optional)',
    nextNotePlaceholder: 'e.g. send the final price offer',
    save: 'Save activity',
    saving: 'Saving…',
    saved: 'Activity logged',
    pastDate: 'Pick a time in the future',
    error: 'Could not save',
  },
  current: {
    title: 'Next follow-up',
    none: 'No follow-up set — set one when you log the next activity.',
    overdue: 'Overdue',
    today: 'Today',
    upcoming: 'Upcoming',
  },
  timeline: {
    title: 'Follow-up log',
    desc: 'Every call, meeting and message with the customer, how it went, and the replies.',
    empty: 'No activity logged yet',
    emptyDesc: 'Log the first call or note with the form above.',
    scheduled: 'Scheduled a follow-up',
    reply: 'Reply',
    replies: 'Replies',
    replyPlaceholder: 'Write a reply…',
    send: 'Send',
    cancel: 'Cancel',
    unknownAuthor: 'User',
  },
  page: {
    eyebrow: 'Sales',
    title: 'Follow-ups',
    desc: 'Customers due a contact: overdue first, then today, then upcoming.',
    tabs: { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming' },
    hint: {
      overdue: 'These customers were due a contact — start with them.',
      today: 'Follow-ups still due today.',
      upcoming: 'Follow-ups after today.',
    },
    empty: {
      overdue: 'No overdue follow-ups — nice work.',
      today: 'No follow-ups left today.',
      upcoming: 'No upcoming follow-ups.',
    },
    emptyHint: 'Set the next follow-up whenever you log an activity on a customer.',
    lead: 'Customer',
    due: 'Due',
    action: 'To do',
    last: 'Last activity',
    owner: 'Owner',
    noActivity: 'No activity',
    open: 'Open',
    call: 'Call',
    whatsapp: 'WhatsApp',
    error: 'Could not load follow-ups',
  },
  panel: {
    title: "Today's follow-ups",
    desc: 'Overdue and due today',
    all: 'All follow-ups',
    clear: 'Nothing overdue or due today.',
  },
  ago: { now: 'now', min: 'm', hour: 'h', day: 'd' },
};

export function followUpT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
export type FollowUpMessages = typeof ar;

/** Where a follow-up time falls: past due, later today, or after today (the viewer's day). */
export function followUpState(at: string | Date, now = new Date()): 'overdue' | 'today' | 'upcoming' {
  const t = new Date(at);
  if (t.getTime() < now.getTime()) return 'overdue';
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return t.getTime() < end.getTime() ? 'today' : 'upcoming';
}

/** A WhatsApp chat link for a phone number (digits only, no plus). */
export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}
