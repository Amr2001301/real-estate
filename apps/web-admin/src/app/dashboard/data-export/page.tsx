export const dynamic = 'force-dynamic';

import { HardDriveDownload, Database, ShieldCheck, Clock } from 'lucide-react';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { ExportMenu } from '@/components/export-menu';

export default function DataExportPage() {
  return (
    <div className="space-y-6">
      <PremiumPageHero
        title="تصدير البيانات"
        description="تصدير كامل بيانات الشركة في ملف Excel واحد — المشاريع والوحدات والعملاء والعقود وكل السجلات المالية"
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'تصدير البيانات' },
        ]}
        actions={
          <ExportMenu
            xlsxPath="/data-export/export.xlsx"
            filenameBase="tenant-export"
            label="تصدير الكل"
          />
        }
      />

      <PremiumSectionCard
        title="ما يتضمّنه الملف"
        description="15 ورقة تغطي جميع كيانات المنصة"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {SHEETS.map((s) => (
            <div
              key={s.name}
              className="flex items-start gap-3 rounded-xl border border-hairline bg-surface p-3"
            >
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">{s.name}</p>
                <p className="text-2xs text-slate-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </PremiumSectionCard>

      <PremiumSectionCard title="ملاحظات" description="اقرأ قبل الاستخدام">
        <ul className="space-y-3 p-4 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            <span>الملف مقيّد بشركتك فقط — لا يمكن تصدير بيانات مستأجر آخر.</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>كل عملية تصدير تُسجَّل في سجل التدقيق باسمك وتاريخ التنفيذ.</span>
          </li>
          <li className="flex items-start gap-2">
            <HardDriveDownload className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              الأعمدة ذات المفتاح <span dir="ltr" className="font-mono text-2xs bg-slate-100 px-1 rounded">_Ref</span> هي المرجع المختصر
              للسجل — يُستخدم لاحقاً في الاستيراد لتحديد السجلات الموجودة.
            </span>
          </li>
        </ul>
      </PremiumSectionCard>
    </div>
  );
}

const SHEETS = [
  { name: 'المشاريع',         desc: 'جميع المشاريع بعمودَي الاسم AR/EN' },
  { name: 'المراحل',          desc: 'مراحل كل مشروع' },
  { name: 'المباني',          desc: 'المباني مرتبطة بالمرحلة والمشروع' },
  { name: 'الوحدات',          desc: 'السعر والمساحة والطابق والحالة' },
  { name: 'العملاء',          desc: 'بيانات العملاء (CLIENT فقط، لا كلمات مرور)' },
  { name: 'فرص المبيعات',     desc: 'CRM — المرحلة، المصدر، المندوب' },
  { name: 'العقود',           desc: 'شامل بيانات الإلغاء إن وُجدت' },
  { name: 'خطط التقسيط',      desc: 'إجمالي مدفوع والرصيد المتبقي' },
  { name: 'الأقساط',          desc: 'تفاصيل كل قسط مع تاريخ الاستحقاق والسداد' },
  { name: 'الدفعات',          desc: 'مرتبطة بالعقود مع مرجع العميل' },
  { name: 'أدوات الدفع',      desc: 'الشيكات المرتجعة وتفاصيل التحصيل' },
  { name: 'المستردات',        desc: 'المبالغ المستردة للعقود الملغاة' },
  { name: 'الوسطاء',          desc: 'الشركات الوسيطة وبيانات التواصل' },
  { name: 'العمولات',         desc: 'شامل حالة الاسترداد clawback' },
  { name: 'الصيانة',          desc: 'طلبات الصيانة والحالة' },
];
