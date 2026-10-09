import {
  countText,
  dataTable,
  kpiGrid,
  moneyText,
  percentText,
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import type { ReportBrand } from '../../common/utils/report-brand';

/**
 * A contract's installment schedule as a statement PDF (HTML → Chromium):
 * the plan's progress and every payment with its status. Layout only.
 */

export const PLAN_STATUS_AR: Record<string, string> = {
  PENDING: 'معلّق',
  OVERDUE: 'متأخر',
  PAID: 'مدفوع',
  CANCELLED: 'ملغى',
};

export const PLAN_TYPE_AR: Record<string, string> = {
  RESERVATION: 'حجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط',
  FINAL_PAYMENT: 'دفعة أخيرة',
  BOUNCE_PENALTY: 'غرامة شيك مرتد',
};

export interface InstallmentPlanReportData {
  contractNumber: string;
  customer: string;
  unit: string;
  rows: Array<{ dueDate: string; type: string; amount: number; status: string; paidAt: string }>;
}

export function installmentPlanReportHtml(
  d: InstallmentPlanReportData,
  brand: ReportBrand,
): string {
  const c = brand.currency;
  const live = d.rows.filter((r) => r.status !== 'CANCELLED');
  const total = live.reduce((a, r) => a + r.amount, 0);
  const paid = live.filter((r) => r.status === 'PAID').reduce((a, r) => a + r.amount, 0);
  const overdue = live.filter((r) => r.status === 'OVERDUE').reduce((a, r) => a + r.amount, 0);
  const outstanding = live
    .filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE')
    .reduce((a, r) => a + r.amount, 0);
  const next = live.find((r) => r.status === 'PENDING' || r.status === 'OVERDUE');

  return reportDocument({
    brand,
    title: 'كشف الأقساط',
    subtitle: `عقد ${d.contractNumber}`,
    meta: [
      ['العميل', d.customer],
      ['الوحدة', d.unit],
    ],
    body: [
      section(
        'الملخص',
        kpiGrid([
          {
            label: 'إجمالي الخطة',
            value: moneyText(total, c),
            hint: `${countText(live.length)} دفعة`,
          },
          {
            label: 'المدفوع',
            value: moneyText(paid, c),
            hint: `${percentText(paid, total)} من الخطة`,
            tone: 'good',
          },
          { label: 'المتبقي', value: moneyText(outstanding, c) },
          { label: 'المتأخر', value: moneyText(overdue, c), tone: overdue ? 'warn' : 'default' },
        ]),
      ),
      ...(next
        ? [
            section(
              'الدفعة القادمة',
              kpiGrid(
                [
                  {
                    label: `مستحقة في ${next.dueDate}`,
                    value: moneyText(next.amount, c),
                    tone: next.status === 'OVERDUE' ? 'warn' : 'default',
                  },
                ],
                2,
              ),
            ),
          ]
        : []),
      section(
        'جدول الأقساط',
        dataTable(
          [
            { label: '#', numeric: true, width: 0.4 },
            { label: 'تاريخ الاستحقاق', numeric: true },
            { label: 'النوع' },
            { label: 'المبلغ', numeric: true, width: 1.3 },
            { label: 'الحالة', width: 0.8 },
            { label: 'تاريخ الدفع', numeric: true },
          ],
          d.rows.map((r, i) => [
            i + 1,
            r.dueDate,
            PLAN_TYPE_AR[r.type] ?? r.type,
            moneyText(r.amount, c),
            PLAN_STATUS_AR[r.status] ?? r.status,
            r.paidAt || '—',
          ]),
          {
            totals: ['', '', 'الإجمالي (عدا الملغى)', moneyText(total, c), '', ''],
            empty: 'لا توجد أقساط',
          },
        ),
      ),
    ].join('\n'),
  });
}
