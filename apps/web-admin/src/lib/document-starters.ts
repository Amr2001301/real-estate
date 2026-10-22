import type { TemplateDocument, TemplateVariant } from './print-settings';

/**
 * Starting wordings a company can begin from and edit. They are a common
 * shape for these documents, not legal advice: each company reviews its
 * wording with its own lawyer.
 */
export interface StarterWording {
  documentType: TemplateDocument;
  variant: TemplateVariant;
  name: string;
  body: string;
}

const PREAMBLE = `إنه في يوم {{contract.date}} تحرر هذا العقد بين كل من:

أولاً: {{company.name}}، سجل تجاري رقم {{company.registration}}، ومقرها {{company.address}}، ويمثلها في التوقيع على هذا العقد السيد/ {{company.signatory}} بصفته {{company.signatoryTitle}} (طرف أول بائع).

ثانياً: السيد/ {{customer.name}}، هاتف {{customer.phone}} (طرف ثانٍ مشترٍ).

وبعد أن أقر الطرفان بأهليتهما للتعاقد والتصرف، اتفقا على ما يلي:`;

const UNIT = `## البند الأول: التمهيد
يعتبر التمهيد السابق جزءاً لا يتجزأ من هذا العقد ومتمماً ومكملاً له.

## البند الثاني: محل العقد
باع الطرف الأول للطرف الثاني القابل لذلك الوحدة رقم {{unit.code}} من نوع {{unit.type}} بالدور {{unit.floor}} بمبنى {{unit.building}} بمشروع {{unit.project}}، بمساحة إجمالية قدرها {{unit.area}} متر مربع تقريباً.`;

const DELIVERY = `## تسليم الوحدة
يلتزم الطرف الأول بتسليم الوحدة للطرف الثاني في موعد غايته {{contract.deliveryDate}}، بشرط وفاء الطرف الثاني بكامل التزاماته المالية المستحقة حتى تاريخ التسليم.

## الالتزامات العامة
يلتزم الطرف الثاني بالمحافظة على الوحدة واستعمالها في الغرض المخصصة له، وبسداد حصته في مصروفات الصيانة والخدمات المشتركة وفقاً للائحة المشروع.

## الاختصاص
تختص محاكم مقر الطرف الأول بنظر أي نزاع ينشأ عن تفسير أو تنفيذ هذا العقد.

## نسخ العقد
حُرر هذا العقد من نسختين بيد كل طرف نسخة للعمل بموجبها عند اللزوم.`;

export const STARTER_WORDINGS: StarterWording[] = [
  {
    documentType: 'CONTRACT',
    variant: 'INSTALLMENT',
    name: 'عقد بيع بالتقسيط',
    body: `${PREAMBLE}

${UNIT}

## البند الثالث: الثمن وطريقة السداد
تم هذا البيع نظير ثمن إجمالي قدره {{contract.total}} ({{contract.totalWords}})، يسدده الطرف الثاني على النحو التالي:
- مقدم تعاقد قدره {{contract.downPayment}} ({{contract.downPaymentWords}}) عند التوقيع على هذا العقد.
- والباقي وقدره {{contract.remaining}} على {{plan.count}} قسطاً بدورية سداد ({{plan.frequency}}) قيمة كل قسط {{plan.installment}}، يستحق أولها في {{plan.firstDue}} وآخرها في {{plan.lastDue}}، وفقاً لجدول الأقساط المرفق بهذا العقد.

## البند الرابع: التأخر في السداد
في حالة تأخر الطرف الثاني عن سداد أي قسط في موعد استحقاقه، يحق للطرف الأول المطالبة بغرامة التأخير المنصوص عليها في سياسة الشركة، وفي حالة التأخر عن سداد قسطين متتاليين يحق للطرف الأول فسخ هذا العقد بعد إنذار الطرف الثاني.

${DELIVERY}`,
  },
  {
    documentType: 'CONTRACT',
    variant: 'CASH',
    name: 'عقد بيع نقدي',
    body: `${PREAMBLE}

${UNIT}

## البند الثالث: الثمن
تم هذا البيع نظير ثمن إجمالي قدره {{contract.total}} ({{contract.totalWords}})، سدده الطرف الثاني للطرف الأول بالكامل، ويعتبر توقيع الطرف الأول على هذا العقد مخالصة نهائية بالثمن.

${DELIVERY}`,
  },
  {
    documentType: 'RESERVATION',
    variant: 'ANY',
    name: 'شروط استمارة الحجز',
    body: `## شروط الحجز
- يحجز السيد/ {{customer.name}} الوحدة رقم {{unit.code}} بمشروع {{unit.project}} بموجب هذه الاستمارة رقم {{reservation.number}} بتاريخ {{reservation.date}}.
- سدد العميل مبلغ حجز قدره {{reservation.amount}} ({{reservation.amountWords}})، يُخصم من مقدم التعاقد عند توقيع العقد.
- يظل الحجز سارياً حتى {{reservation.expiresAt}}، ويسقط بعدها إذا لم يتم التعاقد، وتعود الوحدة متاحة للبيع.
- في حالة عدول العميل عن الشراء، يُرد مبلغ الحجز وفقاً لسياسة الشركة المعمول بها.
- لا تعتبر هذه الاستمارة عقد بيع، ولا تنتقل بها ملكية الوحدة.`,
  },
];
