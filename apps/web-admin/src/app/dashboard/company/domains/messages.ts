import type { Locale } from '@/lib/locale';

const ar = {
  title: 'النطاقات',
  description: 'اربط نطاق شركتك بموقعها الإلكتروني ليظهر الموقع على عنوانها الخاص بشهادة أمان.',
  breadcrumbAdmin: 'الإدارة',
  steps: {
    title: 'خطوات ربط النطاق',
    items: [
      'أضف النطاق أدناه (مثل example.com أو www.example.com).',
      'أضف السجلات الظاهرة عند مزوّد النطاق لديك.',
      'يتحقق النظام تلقائياً كل عشر دقائق، ويمكنك الضغط على «تحقق الآن» في أي وقت.',
      'بعد اكتمال التحقق، عيّنه نطاقاً أساسياً ليظهر في الروابط والمشاركات.',
    ],
    note: 'قد يستغرق انتشار سجلات DNS من دقائق إلى ٤٨ ساعة حسب المزوّد.',
  },
  add: { label: 'نطاق جديد', placeholder: 'www.example.com', submit: 'إضافة النطاق' },
  type: { PLATFORM_SUBDOMAIN: 'نطاق المنصة', CUSTOM: 'نطاق مخصص' },
  primary: 'النطاق الأساسي',
  ownership: { verified: 'تم التحقق من الملكية', pending: 'بانتظار التحقق من الملكية' },
  hosting: {
    READY: 'الموقع يعمل على النطاق',
    PENDING: 'جارٍ إعداد الاستضافة',
    ERROR: 'تعذّر إعداد الاستضافة',
    manual: 'تُضاف الاستضافة يدوياً من فريق المنصة',
  },
  records: {
    title: 'السجلات المطلوبة عند مزوّد النطاق',
    type: 'النوع',
    name: 'الاسم',
    value: 'القيمة',
    purpose: { routing: 'توجيه النطاق إلى الموقع', ownership: 'إثبات ملكية النطاق', hosting: 'يطلبه مزوّد الاستضافة' },
    copy: 'نسخ',
    copied: 'تم النسخ',
  },
  lastCheck: 'آخر فحص',
  actions: {
    verify: 'تحقق الآن',
    primary: 'تعيين كنطاق أساسي',
    delete: 'حذف',
    confirmDelete: 'حذف هذا النطاق؟ سيتوقف الموقع عن العمل عليه.',
    notYet: 'لم يكتمل التحقق بعد — تأكد من إضافة السجلات وانتظر انتشارها.',
    done: 'تم التحقق بنجاح.',
  },
  empty: 'لا توجد نطاقات بعد.',
};

const en: typeof ar = {
  title: 'Domains',
  description: 'Connect your company’s domain to its website, served on your own address with a security certificate.',
  breadcrumbAdmin: 'Administration',
  steps: {
    title: 'Connecting a domain',
    items: [
      'Add the domain below (e.g. example.com or www.example.com).',
      'Add the records shown at your domain provider.',
      'The system checks every ten minutes; you can press “Check now” at any time.',
      'Once verified, set it as the primary domain for links and sharing.',
    ],
    note: 'DNS changes can take from minutes up to 48 hours to spread, depending on the provider.',
  },
  add: { label: 'New domain', placeholder: 'www.example.com', submit: 'Add domain' },
  type: { PLATFORM_SUBDOMAIN: 'Platform domain', CUSTOM: 'Custom domain' },
  primary: 'Primary domain',
  ownership: { verified: 'Ownership verified', pending: 'Awaiting ownership check' },
  hosting: {
    READY: 'Website live on this domain',
    PENDING: 'Setting up hosting',
    ERROR: 'Hosting setup failed',
    manual: 'Hosting is added by the platform team',
  },
  records: {
    title: 'Records to add at your domain provider',
    type: 'Type',
    name: 'Name',
    value: 'Value',
    purpose: { routing: 'Points the domain to the website', ownership: 'Proves you own the domain', hosting: 'Required by the hosting' },
    copy: 'Copy',
    copied: 'Copied',
  },
  lastCheck: 'Last checked',
  actions: {
    verify: 'Check now',
    primary: 'Set as primary',
    delete: 'Delete',
    confirmDelete: 'Delete this domain? The website will stop working on it.',
    notYet: 'Not verified yet — make sure the records are added and wait for them to spread.',
    done: 'Verified successfully.',
  },
  empty: 'No domains yet.',
};

export function domainsT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
export type DomainsMessages = typeof ar;
