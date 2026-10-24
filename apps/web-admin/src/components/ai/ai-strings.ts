import type { Locale } from '@/lib/locale';

const ar = {
  title: 'المساعد الذكي',
  description: 'باقات أسئلة المساعد الذكي — منفصلة عن باقات الاشتراك، وتُفتح لكل شركة حسب الاتفاق.',
  packages: 'باقات المساعد',
  addPackage: 'باقة جديدة',
  name: 'اسم الباقة',
  questions: 'عدد الأسئلة في الشهر',
  price: 'السعر',
  currency: 'العملة',
  active: 'متاحة',
  stopped: 'موقوفة',
  stop: 'إيقاف',
  resume: 'إتاحة',
  save: 'حفظ',
  cancel: 'إلغاء',
  edit: 'تعديل',
  noPackages: 'لا توجد باقات بعد.',
  attention: 'شركات تحتاج متابعة',
  noAttention: 'لا توجد شركات قريبة من حدّها أو منتهية.',
  reason: {
    NEAR_LIMIT: 'استهلكت 80% أو أكثر',
    EXHAUSTED: 'استهلكت كل الأسئلة',
    ENDING_SOON: 'الباقة تنتهي خلال أيام',
    ENDED: 'الباقة انتهت',
  } as Record<string, string>,
  company: 'الشركة',
  usage: 'الاستهلاك',
  ends: 'تنتهي',
  panelTitle: 'المساعد الذكي',
  notEnabled: 'المساعد غير مفعّل لهذه الشركة.',
  activate: 'تفعيل المساعد',
  renew: 'تجديد الباقة',
  topUp: 'إضافة أسئلة',
  package: 'الباقة',
  agreedPrice: 'السعر المتفق عليه',
  agreedHint: 'يُملأ بسعر الباقة — غيّره لو اتفقت مع الشركة على سعر خاص.',
  note: 'ملاحظة',
  extraQuestions: 'عدد الأسئلة الإضافية',
  topUpHint: 'تُضاف لرصيد هذا الشهر وتنتهي معه.',
  renewHint: 'يبدأ شهر جديد من اليوم؛ ما تبقّى من الشهر الحالي لا يُرحَّل.',
  used: 'مستخدم',
  of: 'من',
  remaining: 'متبقٍ',
  period: 'الفترة',
  ledger: 'سجل الحساب',
  noLedger: 'لا توجد حركات بعد.',
  type: { ACTIVATE: 'تفعيل', RENEW: 'تجديد', TOP_UP: 'أسئلة إضافية' } as Record<string, string>,
  date: 'التاريخ',
  status: { ACTIVE: 'ساري', EXHAUSTED: 'الأسئلة خلصت', ENDED: 'منتهية' } as Record<string, string>,
  error: 'حدث خطأ',
  usageCardTitle: 'المساعد الذكي',
  usageCardLine: (used: number, quota: number) => `استخدمتم ${used} من ${quota} سؤال هذا الشهر`,
  usageCardEnds: (d: string) => `الباقة تنتهي في ${d}`,
  usageCardFull: 'تم استهلاك كل الأسئلة — تواصلوا مع إدارة المنصة لإضافة أسئلة أو التجديد.',
  usageCardEnded: 'انتهت باقة المساعد — تواصلوا مع إدارة المنصة للتجديد.',
  chat: {
    description: 'اسأل عن بيانات شركتك — الأقساط المتأخرة، الوحدات المتاحة، الفرص والحجوزات والزيارات. يقرأ فقط ولا يغيّر أي شيء.',
    placeholder: 'اكتب سؤالك…',
    send: 'إرسال',
    thinking: 'جارٍ البحث في البيانات…',
    clear: 'محادثة جديدة',
    you: 'أنت',
    assistant: 'المساعد',
    scopeHint: 'يجيب من البيانات المتاحة لك فقط. كل سؤال يُحتسب من باقة الشركة.',
    suggestions: [
      'مين العملاء اللي عليهم أقساط متأخرة؟',
      'إيه الوحدات المتاحة بـ 3 غرف أو أكثر؟',
      'ملخص سريع للمبيعات والحجوزات',
      'إيه الزيارات اللي عندي النهارده وبكرة؟',
    ],
    unavailable: {
      NOT_CONFIGURED: 'المساعد الذكي غير متاح على المنصة حاليًا.',
      NOT_ACTIVE: 'المساعد غير مفعّل لشركتك أو انتهت باقته — تواصل مع مدير الشركة.',
      EXHAUSTED: 'تم استهلاك كل أسئلة الباقة لهذا الشهر — تواصل مع مدير الشركة.',
    } as Record<string, string>,
    errors: {
      AI_QUOTA_EXHAUSTED: 'تم استهلاك كل أسئلة الباقة لهذا الشهر.',
      AI_NOT_ACTIVE: 'المساعد غير مفعّل أو انتهت مدة الباقة.',
      AI_NOT_CONFIGURED: 'المساعد الذكي غير متاح حاليًا.',
      AI_UNAVAILABLE: 'تعذّر الوصول إلى المساعد — لم يُحتسب السؤال، حاول مرة أخرى.',
      RATE: 'أسئلة كثيرة في وقت قصير — انتظر دقيقة ثم حاول.',
    } as Record<string, string>,
  },
};

const en: typeof ar = {
  title: 'AI assistant',
  description: 'AI assistant question packages — separate from the subscription plans, opened for each company by agreement.',
  packages: 'Assistant packages',
  addPackage: 'New package',
  name: 'Package name',
  questions: 'Questions a month',
  price: 'Price',
  currency: 'Currency',
  active: 'Available',
  stopped: 'Stopped',
  stop: 'Stop',
  resume: 'Make available',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  noPackages: 'No packages yet.',
  attention: 'Companies to follow up',
  noAttention: 'No company is near its limit or ended.',
  reason: {
    NEAR_LIMIT: 'Used 80% or more',
    EXHAUSTED: 'All questions used',
    ENDING_SOON: 'Package ends in days',
    ENDED: 'Package ended',
  },
  company: 'Company',
  usage: 'Usage',
  ends: 'Ends',
  panelTitle: 'AI assistant',
  notEnabled: 'The assistant is not enabled for this company.',
  activate: 'Enable the assistant',
  renew: 'Renew package',
  topUp: 'Add questions',
  package: 'Package',
  agreedPrice: 'Agreed price',
  agreedHint: "Filled with the package's price — change it for a special agreement.",
  note: 'Note',
  extraQuestions: 'Extra questions',
  topUpHint: "Added to this month's balance; they end with it.",
  renewHint: 'A new month starts today; what is left of this month does not carry over.',
  used: 'used',
  of: 'of',
  remaining: 'left',
  period: 'Period',
  ledger: 'Account history',
  noLedger: 'No entries yet.',
  type: { ACTIVATE: 'Enabled', RENEW: 'Renewed', TOP_UP: 'Extra questions' },
  date: 'Date',
  status: { ACTIVE: 'Active', EXHAUSTED: 'Questions used up', ENDED: 'Ended' },
  error: 'Something went wrong',
  usageCardTitle: 'AI assistant',
  usageCardLine: (used, quota) => `You used ${used} of ${quota} questions this month`,
  usageCardEnds: (d) => `The package ends on ${d}`,
  usageCardFull: 'All questions are used — contact the platform to add questions or renew.',
  usageCardEnded: 'The assistant package has ended — contact the platform to renew.',
  chat: {
    description: "Ask about your company's data — overdue installments, available units, leads, reservations and visits. It only reads; it changes nothing.",
    placeholder: 'Type your question…',
    send: 'Send',
    thinking: 'Looking through the data…',
    clear: 'New chat',
    you: 'You',
    assistant: 'Assistant',
    scopeHint: "Answers only from the data you can see. Each question counts against the company's package.",
    suggestions: [
      'Which customers have overdue installments?',
      'Which units with 3+ bedrooms are available?',
      'A quick summary of sales and reservations',
      'What visits do I have today and tomorrow?',
    ],
    unavailable: {
      NOT_CONFIGURED: 'The AI assistant is not available on the platform right now.',
      NOT_ACTIVE: "The assistant isn't enabled for your company or its package ended — contact your company admin.",
      EXHAUSTED: "This month's questions are used up — contact your company admin.",
    },
    errors: {
      AI_QUOTA_EXHAUSTED: "This month's questions are used up.",
      AI_NOT_ACTIVE: "The assistant isn't enabled or its package ended.",
      AI_NOT_CONFIGURED: 'The AI assistant is not available right now.',
      AI_UNAVAILABLE: "Couldn't reach the assistant — the question was not counted; try again.",
      RATE: 'Too many questions in a short time — wait a minute and try again.',
    },
  },
};

export function aiT(locale: Locale) {
  return locale === 'en' ? en : ar;
}

export interface AiPlanView {
  packageId: string | null;
  packageName: string | null;
  periodStart: string;
  periodEnd: string;
  quota: number;
  used: number;
  remaining: number;
  usedPct: number;
  active: boolean;
  status: 'ACTIVE' | 'EXHAUSTED' | 'ENDED';
}

export function usageTone(p: Pick<AiPlanView, 'status' | 'usedPct'>) {
  if (p.status !== 'ACTIVE') return 'bg-danger-600';
  if (p.usedPct >= 80) return 'bg-warning-500';
  return 'bg-brand-600';
}

export async function readError(res: Response, fallback: string) {
  try {
    const d = (await res.json()) as { message?: string | string[] };
    return Array.isArray(d.message) ? d.message.join('، ') : (d.message ?? fallback);
  } catch {
    return fallback;
  }
}
