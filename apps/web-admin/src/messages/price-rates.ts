import type { Locale } from '@/lib/locale';

/** «أسعار المتر الحالية» — a project's prices per meter for «قيمة وحدتك». */
const ar = {
  open: 'أسعار المتر',
  title: 'أسعار المتر الحالية',
  description:
    'منها نحسب «قيمة وحدتك» للعملاء: مساحة الوحدة × سعر المتر الحالي لوحدات مشابهة في نفس المشروع. سعر الوحدات المتاحة يُحسب تلقائيًا؛ اكتب سعرك أنت للنوع اللي خلص بيعه.',
  off: 'الميزة مقفولة حاليًا ولن يراها العملاء. شغّلها من الإعدادات: «إظهار قيمة وحدتك للعملاء».',
  settingsLink: 'فتح الإعدادات',
  colType: 'نوع الوحدة',
  colUnits: 'الوحدات',
  colMarket: 'متوسط المتاح الآن',
  colManual: 'سعرك أنت',
  colNew: 'سعر جديد للمتر',
  wholeProject: 'كل المشروع',
  forSale: (n: number, total: number) => `${n} متاحة من ${total}`,
  noneForSale: 'لا توجد وحدات متاحة',
  since: (d: string) => `منذ ${d}`,
  save: 'حفظ',
  saved: 'تم حفظ سعر المتر',
  howTitle: 'إزاي بنختار سعر المتر لوحدة العميل',
  how: [
    'متوسط الوحدات المتاحة من نفس النموذج',
    'ولو مفيش: متوسط المتاح من نفس النوع',
    'ولو مفيش: سعرك أنت لنفس النوع',
    'ولو مفيش: متوسط المتاح بنفس الاستخدام (سكني / تجاري…)',
    'ولو مفيش: سعرك أنت لكل المشروع — ولو مفيش خالص، الكارت مش بيظهر',
  ],
  perMeter: 'ج.م/م²',
};

const en: typeof ar = {
  open: 'Prices per m²',
  title: 'Current prices per meter',
  description:
    "Used to value customers' units («Your unit's value»): unit area × today's price per meter of similar units in the same project. Units for sale are averaged automatically; enter your own figure for a type that sold out.",
  off: 'The feature is off, so customers do not see it. Turn it on in settings: "Show customers their unit value".',
  settingsLink: 'Open settings',
  colType: 'Unit type',
  colUnits: 'Units',
  colMarket: 'Average for sale now',
  colManual: 'Your figure',
  colNew: 'New price per m²',
  wholeProject: 'Whole project',
  forSale: (n: number, total: number) => `${n} for sale of ${total}`,
  noneForSale: 'None for sale',
  since: (d: string) => `since ${d}`,
  save: 'Save',
  saved: 'Price per meter saved',
  howTitle: "How a customer's unit is priced",
  how: [
    'Average of units for sale of the same model',
    'Else: average for sale of the same type',
    'Else: your figure for the type',
    'Else: average for sale of the same usage (residential / commercial…)',
    'Else: your figure for the project — and with none at all, the card is not shown',
  ],
  perMeter: 'EGP/m²',
};

export function prT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
