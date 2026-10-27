import type { Locale } from '@/lib/locale';

/*
 * «دومين الموقع» — the address the company's website is served on. The
 * platform owner connects it (super-admin company page); the company's own
 * admin only sees it (visual identity page).
 */
const ar = {
  title: 'دومين الموقع',
  description: 'العنوان الذي يظهر عليه موقع الشركة، مثل acme.com. بدونه يعمل الموقع على عنوان المنصة.',
  steps: {
    title: 'خطوات الربط',
    items: [
      'أضف دومين الشركة (مثل acme.com).',
      'تُضاف السجلات الظاهرة عند مزوّد الدومين (GoDaddy وغيره) — انسخها وأرسلها للشركة أو أضفها بنفسك.',
      'يتحقق النظام تلقائيًا كل عشر دقائق، ويمكنك الضغط على «تحقق الآن» في أي وقت.',
      'بعد الربط اجعله الدومين الأساسي ليظهر في الروابط والمشاركات.',
    ],
    note: 'قد يستغرق انتشار السجلات من دقائق حتى ٤٨ ساعة حسب المزوّد.',
  },
  add: { label: 'إضافة دومين', placeholder: 'acme.com', submit: 'إضافة', another: 'إضافة دومين آخر' },
  primary: 'الأساسي',
  state: { live: 'متصل', waiting: 'بانتظار الربط', error: 'تعذّر التجهيز' },
  stateHint: {
    live: 'الموقع يعمل على هذا الدومين.',
    waiting: 'أضف السجلات عند مزوّد الدومين، وسيتم الربط تلقائيًا بعد انتشارها.',
    error: 'تعذّر تجهيز الموقع على هذا الدومين — اضغط «تحقق الآن» للمحاولة مجددًا.',
  },
  progress: { added: 'أُضيف الدومين', records: 'السجلات', live: 'متصل' },
  platformAddress: 'عنوان المنصة',
  platformHint: 'يعمل دائمًا، حتى بدون دومين خاص.',
  records: {
    title: 'السجلات المطلوب إضافتها',
    hint: 'من لوحة DNS عند مزوّد الدومين (GoDaddy وغيره) — كل سجل بنوعه واسمه وقيمته.',
    type: 'النوع',
    name: 'الاسم',
    value: 'القيمة',
    purpose: { routing: 'يوجّه الدومين إلى الموقع', ownership: 'يثبت ملكية الدومين', hosting: 'تطلبه الاستضافة' },
    copy: 'نسخ',
    copied: 'تم النسخ',
    copyAll: 'نسخ كل السجلات',
  },
  lastCheck: 'آخر فحص',
  actions: {
    verify: 'تحقق الآن',
    primary: 'اجعله الأساسي',
    delete: 'حذف',
    confirmDelete: 'حذف هذا الدومين؟ سيتوقف الموقع عن العمل عليه.',
    notYet: 'لم يكتمل الربط بعد — تأكد من إضافة السجلات وانتظر انتشارها.',
    done: 'تم الربط بنجاح.',
  },
  empty: 'لا يوجد دومين خاص — الموقع يعمل على عنوان المنصة فقط.',
  error: 'حدث خطأ',
  company: {
    description: 'العنوان الذي يظهر عليه موقعكم الإلكتروني.',
    managed: 'ربط الدومين أو تغييره يتم من خلال إدارة المنصة — تواصلوا معنا لإضافة دومين شركتكم.',
    stateHint: {
      live: 'موقعكم يعمل على هذا الدومين.',
      waiting: 'فريق المنصة يعمل على ربط هذا الدومين بموقعكم.',
      error: 'يوجد عائق في ربط هذا الدومين — فريق المنصة يتابعه.',
    },
  },
};

const en: typeof ar = {
  title: 'Website domain',
  description: "The address the company's website is served on, e.g. acme.com. Without one, the site runs on the platform's address.",
  steps: {
    title: 'Connecting it',
    items: [
      "Add the company's domain (e.g. acme.com).",
      'The records shown go at the domain provider (GoDaddy and the like) — copy them to the company or add them yourself.',
      'The system checks every ten minutes; you can press “Check now” at any time.',
      'Once connected, make it the primary domain for links and sharing.',
    ],
    note: 'Records can take from minutes up to 48 hours to spread, depending on the provider.',
  },
  add: { label: 'Add a domain', placeholder: 'acme.com', submit: 'Add', another: 'Add another domain' },
  primary: 'Primary',
  state: { live: 'Connected', waiting: 'Awaiting connection', error: 'Setup failed' },
  stateHint: {
    live: 'The website is live on this domain.',
    waiting: 'Add the records at the domain provider; it connects by itself once they spread.',
    error: 'The website could not be set up on this domain — press “Check now” to try again.',
  },
  progress: { added: 'Domain added', records: 'Records', live: 'Connected' },
  platformAddress: 'Platform address',
  platformHint: 'Always works, even without a domain of its own.',
  records: {
    title: 'Records to add',
    hint: "In the domain provider's DNS settings (GoDaddy and the like) — each with its type, name and value.",
    type: 'Type',
    name: 'Name',
    value: 'Value',
    purpose: { routing: 'Points the domain to the website', ownership: 'Proves the domain is owned', hosting: 'Required by the hosting' },
    copy: 'Copy',
    copied: 'Copied',
    copyAll: 'Copy all records',
  },
  lastCheck: 'Last checked',
  actions: {
    verify: 'Check now',
    primary: 'Make primary',
    delete: 'Delete',
    confirmDelete: 'Delete this domain? The website will stop working on it.',
    notYet: 'Not connected yet — make sure the records are added and wait for them to spread.',
    done: 'Connected.',
  },
  empty: "No domain of its own — the site runs on the platform's address only.",
  error: 'Something went wrong',
  company: {
    description: 'The address your website is served on.',
    managed: 'Connecting or changing the domain is done by the platform team — contact us to add your company’s domain.',
    stateHint: {
      live: 'Your website is live on this domain.',
      waiting: 'The platform team is connecting this domain to your website.',
      error: 'Connecting this domain hit a problem — the platform team is on it.',
    },
  },
};

export function domainT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
export type DomainMessages = typeof ar;
