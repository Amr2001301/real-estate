import type { Locale } from '@/lib/locale';

export type LaunchStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';
export type EoiStatus = 'PENDING_PAYMENT' | 'PAID' | 'ALLOCATED' | 'REFUNDED' | 'CANCELLED';

/* BRK-6 — launches and expressions of interest. Strings only. */
const ar = {
  status: { UPCOMING: 'قريبًا', OPEN: 'مفتوح', CLOSED: 'مغلق' } satisfies Record<LaunchStatus, string>,
  eoiStatus: { PENDING_PAYMENT: 'بانتظار الدفع', PAID: 'مدفوع — في الطابور', ALLOCATED: 'خُصّصت وحدة', REFUNDED: 'تم الرد', CANCELLED: 'ملغي' } satisfies Record<EoiStatus, string>,
  list: {
    eyebrow: 'البيع الأولي',
    title: 'الإطلاقات',
    desc: 'إطلاقات المطوّرين وطلبات اهتمام العملاء (EOI): المبلغ المسترد، ترتيب الطابور، والتخصيص يوم الإطلاق.',
    add: 'إطلاق جديد',
    empty: 'لا إطلاقات بعد',
    emptyHint: 'أضف إطلاقًا قادمًا وابدأ تجميع طلبات الاهتمام من عملائك.',
    kpiLaunches: 'إطلاقات مفتوحة وقادمة',
    kpiEois: 'طلبات اهتمام',
    kpiHeld: 'مبالغ محتجزة',
    kpiAllocated: 'خُصّصت لهم وحدات',
    launchOn: (d: string) => `الإطلاق ${d}`,
    eoiAmount: 'مبلغ الطلب',
    eois: (n: number) => `${n} طلب`,
    paid: 'مدفوع',
    pending: 'بانتظار الدفع',
    allocated: 'مخصّص',
  },
  form: {
    title: 'إطلاق جديد',
    name: 'اسم الإطلاق',
    project: 'المشروع من الدليل',
    noProject: 'بدون — أكتب المطوّر',
    developer: 'المطوّر',
    date: 'تاريخ الإطلاق',
    amount: 'مبلغ طلب الاهتمام (مسترد)',
    notes: 'ملاحظات',
    save: 'حفظ',
    cancel: 'إلغاء',
  },
  detail: {
    queue: 'طابور الطلبات',
    queueSub: 'الطلبات المدفوعة بترتيب وقت الدفع — هذا ترتيب الاختيار يوم الإطلاق.',
    yourEois: 'طلباتك',
    allEois: 'الطلبات',
    addEoi: 'طلب اهتمام جديد',
    lead: 'فرصة العميل',
    leadPlaceholder: 'ابحث بالاسم أو الهاتف…',
    orWalkIn: 'أو عميل غير مسجّل',
    customerName: 'اسم العميل',
    customerPhone: 'الهاتف',
    preference: 'ما يريده',
    preferencePlaceholder: 'مثال: شقة 3 غرف، دور متوسط',
    budget: 'الميزانية',
    save: 'تسجيل الطلب',
    cancel: 'إلغاء',
    place: (n: number) => `#${n}`,
    pay: 'تسجيل الدفع',
    paymentRef: 'رقم العملية',
    allocate: 'تخصيص وحدة',
    allocation: 'الوحدة المخصّصة',
    allocationPlaceholder: 'مثال: شقة B-204 الدور الثاني',
    refund: 'رد المبلغ',
    cancelEoi: 'إلغاء الطلب',
    empty: 'لا طلبات بعد',
    status: 'حالة الإطلاق',
    setStatus: { UPCOMING: 'قريبًا', OPEN: 'فتح الإطلاق', CLOSED: 'إغلاق الإطلاق' } satisfies Record<LaunchStatus, string>,
    held: 'محتجز',
    paidOn: (d: string) => `دُفع ${d}`,
    agent: 'المندوب',
    confirm: 'تأكيد',
  },
};

const en: typeof ar = {
  status: { UPCOMING: 'Upcoming', OPEN: 'Open', CLOSED: 'Closed' },
  eoiStatus: { PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid — in queue', ALLOCATED: 'Unit allocated', REFUNDED: 'Refunded', CANCELLED: 'Cancelled' },
  list: {
    eyebrow: 'Primary sales',
    title: 'Launches',
    desc: 'Developers’ launches and your clients’ expressions of interest (EOIs): the refundable amount, the queue, and allocation on the day.',
    add: 'New launch',
    empty: 'No launches yet',
    emptyHint: 'Add an upcoming launch and start collecting EOIs from your clients.',
    kpiLaunches: 'Open & upcoming',
    kpiEois: 'EOIs',
    kpiHeld: 'Amounts held',
    kpiAllocated: 'Allocated',
    launchOn: (d: string) => `Launch ${d}`,
    eoiAmount: 'EOI amount',
    eois: (n: number) => `${n} EOIs`,
    paid: 'Paid',
    pending: 'Awaiting payment',
    allocated: 'Allocated',
  },
  form: {
    title: 'New launch',
    name: 'Launch name',
    project: 'Project from the directory',
    noProject: 'None — type the developer',
    developer: 'Developer',
    date: 'Launch date',
    amount: 'EOI amount (refundable)',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
  },
  detail: {
    queue: 'EOI queue',
    queueSub: 'Paid EOIs in payment order — the order of choice on launch day.',
    yourEois: 'Your EOIs',
    allEois: 'EOIs',
    addEoi: 'New EOI',
    lead: 'Customer lead',
    leadPlaceholder: 'Search by name or phone…',
    orWalkIn: 'or an unregistered customer',
    customerName: 'Customer name',
    customerPhone: 'Phone',
    preference: 'Looking for',
    preferencePlaceholder: 'e.g. 3-bed apartment, mid floor',
    budget: 'Budget',
    save: 'Record EOI',
    cancel: 'Cancel',
    place: (n: number) => `#${n}`,
    pay: 'Record payment',
    paymentRef: 'Payment reference',
    allocate: 'Allocate unit',
    allocation: 'Allocated unit',
    allocationPlaceholder: 'e.g. Apartment B-204, 2nd floor',
    refund: 'Refund',
    cancelEoi: 'Cancel EOI',
    empty: 'No EOIs yet',
    status: 'Launch status',
    setStatus: { UPCOMING: 'Upcoming', OPEN: 'Open launch', CLOSED: 'Close launch' },
    held: 'Held',
    paidOn: (d: string) => `Paid ${d}`,
    agent: 'Agent',
    confirm: 'Confirm',
  },
};

export function launchesT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export interface LaunchRow {
  id: string;
  name: string;
  developerName: string;
  developerProject: { id: string; name: string } | null;
  launchDate: string;
  eoiAmount: string;
  status: LaunchStatus;
  notes: string | null;
  counts: { total: number; pending: number; paid: number; allocated: number; refunded: number };
  held: number;
}

export interface Eoi {
  id: string;
  customerName: string;
  customerPhone: string;
  preference: string | null;
  budget: string | null;
  amount: string;
  status: EoiStatus;
  paidAt: string | null;
  paymentRef: string | null;
  allocation: string | null;
  queue: number | null;
  agent: { id: string; fullName: string } | null;
  lead: { id: string; fullName: string } | null;
}

export interface LaunchDetail extends Omit<LaunchRow, 'counts' | 'held'> {
  queueLength: number;
  eois: Eoi[];
}
