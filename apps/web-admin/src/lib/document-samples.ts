import { amountInWords, type TemplateValues } from './document-template';

/** Sample values for the preview: what a real sale fills in. */
export function sampleValues(locale: 'ar' | 'en', currency: string, company: string): TemplateValues {
  const ar = locale === 'ar';
  const money = (n: number) =>
    new Intl.NumberFormat(ar ? 'ar-EG-u-nu-latn' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  return {
    'company.name': company,
    'company.registration': '123456',
    'company.address': ar ? 'التجمع الخامس، القاهرة الجديدة' : 'Fifth Settlement, New Cairo',
    'company.phone': '+20 100 000 0000',
    'company.signatory': ar ? 'أحمد محمود' : 'Ahmed Mahmoud',
    'company.signatoryTitle': ar ? 'المدير التنفيذي' : 'Chief Executive',
    'customer.name': ar ? 'محمد علي حسن' : 'Mohamed Ali Hassan',
    'customer.phone': '+20 111 222 3333',
    'customer.email': 'client@example.com',
    'customer.nationalId': '29001011234567',
    'customer.address': ar ? '12 شارع التسعين، التجمع الخامس، القاهرة الجديدة' : '12 90th Street, Fifth Settlement, New Cairo',
    'customer.birthDate': ar ? '17 مايو 1990' : '17 May 1990',
    'customer.birthPlace': ar ? 'المنصورة' : 'Mansoura',
    'customer.occupation': ar ? 'مهندس مدني' : 'Civil engineer',
    'customer.employer': ar ? 'شركة النيل للمقاولات' : 'Nile Contracting',
    'customer.idIssueDate': ar ? '2 يناير 2020' : '2 Jan 2020',
    'customer.idIssuePlace': ar ? 'سجل مدني مدينة نصر' : 'Nasr City civil registry',
    'customer.homePhone': '02 2260 1234',
    'unit.code': 'A-1204',
    'unit.type': ar ? 'شقة' : 'Apartment',
    'unit.area': '165',
    'unit.floor': '12',
    'unit.building': ar ? 'مبنى A' : 'Building A',
    'unit.project': ar ? 'مشروع النخيل' : 'Palm Residence',
    'contract.number': 'CT-2026-0148',
    'contract.date': ar ? '15 أكتوبر 2026' : '15 Oct 2026',
    'contract.total': money(3_250_000),
    'contract.totalWords': amountInWords(3_250_000, currency, locale),
    'contract.downPayment': money(650_000),
    'contract.downPaymentWords': amountInWords(650_000, currency, locale),
    'contract.remaining': money(2_600_000),
    'contract.deliveryDate': ar ? '30 يونيو 2029' : '30 Jun 2029',
    'plan.count': '20',
    'plan.installment': money(130_000),
    'plan.frequency': ar ? 'ربع سنوي' : 'Quarterly',
    'plan.months': '60',
    'plan.firstDue': ar ? '15 يناير 2027' : '15 Jan 2027',
    'plan.lastDue': ar ? '15 أكتوبر 2031' : '15 Oct 2031',
    'reservation.number': 'RS-2026-0311',
    'reservation.date': ar ? '1 أكتوبر 2026' : '1 Oct 2026',
    'reservation.amount': money(100_000),
    'reservation.amountWords': amountInWords(100_000, currency, locale),
    'reservation.expiresAt': ar ? '8 أكتوبر 2026' : '8 Oct 2026',
    today: new Intl.DateTimeFormat(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(new Date()),
  };
}
