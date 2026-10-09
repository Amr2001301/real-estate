import type { Locale } from '@/lib/locale';

// /dashboard/data-export — the full company workbook (backup / re-import).

const ar = {
  title: 'تصدير البيانات',
  description: 'كامل بيانات الشركة في ملف Excel واحد — المشاريع والوحدات والعملاء والعقود وكل السجلات المالية.',
  breadcrumbAdmin: 'الإدارة',
  exportAll: 'تصدير الكل',
  contentsTitle: 'ما يتضمّنه الملف',
  contentsDescription: '15 ورقة تغطي جميع كيانات المنصة',
  notesTitle: 'ملاحظات',
  notesDescription: 'اقرأ قبل الاستخدام',
  noteScope: 'الملف مقيّد بشركتك فقط — لا يمكن تصدير بيانات شركة أخرى.',
  noteAudit: 'كل عملية تصدير تُسجَّل في سجل التدقيق باسمك وتاريخ التنفيذ.',
  noteRefBefore: 'الأعمدة ذات المفتاح',
  noteRefAfter: 'هي المرجع المختصر للسجل — تُستخدم لاحقًا في الاستيراد لتحديد السجلات الموجودة.',
  sheets: [
    ['المشاريع', 'جميع المشاريع بعمودَي الاسم AR/EN'],
    ['المراحل', 'مراحل كل مشروع'],
    ['المباني', 'المباني مرتبطة بالمرحلة والمشروع'],
    ['الوحدات', 'السعر والمساحة والطابق والحالة'],
    ['العملاء', 'بيانات العملاء (بدون كلمات مرور)'],
    ['فرص المبيعات', 'المرحلة والمصدر والمندوب'],
    ['العقود', 'شاملة بيانات الإلغاء إن وُجدت'],
    ['خطط التقسيط', 'إجمالي المدفوع والرصيد المتبقي'],
    ['الأقساط', 'كل قسط بتاريخ الاستحقاق والسداد'],
    ['الدفعات', 'مرتبطة بالعقود مع مرجع العميل'],
    ['أدوات الدفع', 'الشيكات المرتجعة وتفاصيل التحصيل'],
    ['المستردات', 'المبالغ المستردة للعقود الملغاة'],
    ['الوسطاء', 'الشركات الوسيطة وبيانات التواصل'],
    ['العمولات', 'شاملة حالة الاسترداد'],
    ['الصيانة', 'طلبات الصيانة وحالتها'],
  ] as [string, string][],
};

const en: typeof ar = {
  title: 'Data export',
  description: "All of the company's data in one Excel file — projects, units, customers, contracts and every financial record.",
  breadcrumbAdmin: 'Administration',
  exportAll: 'Export everything',
  contentsTitle: "What's in the file",
  contentsDescription: '15 sheets covering every entity on the platform',
  notesTitle: 'Notes',
  notesDescription: 'Read before use',
  noteScope: 'The file is limited to your company — no other company’s data can be exported.',
  noteAudit: 'Every export is recorded in the audit log with your name and the time.',
  noteRefBefore: 'Columns keyed',
  noteRefAfter: "are the record's short reference — import uses them to match existing records.",
  sheets: [
    ['Projects', 'Every project, name in AR/EN'],
    ['Phases', 'The phases of each project'],
    ['Buildings', 'Buildings with their phase and project'],
    ['Units', 'Price, area, floor and status'],
    ['Customers', 'Customer details (no passwords)'],
    ['Leads', 'Stage, source and sales rep'],
    ['Contracts', 'Including cancellation details'],
    ['Installment plans', 'Total paid and the remaining balance'],
    ['Installments', 'Each installment with due and paid dates'],
    ['Deposits', 'Linked to contracts with the customer reference'],
    ['Payment instruments', 'Bounced cheques and collection details'],
    ['Refunds', 'Amounts refunded on cancelled contracts'],
    ['Brokers', 'Broker companies and contacts'],
    ['Commissions', 'Including clawback status'],
    ['Maintenance', 'Maintenance requests and their status'],
  ],
};

export function dataExportT(locale: Locale) {
  return locale === 'en' ? en : ar;
}
