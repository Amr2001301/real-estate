import {
  CHART_FULL,
  chartPanel,
  countText,
  dataTable,
  kpiGrid,
  moneyText,
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import { shareChartSvg } from '../../common/report-pdf/svg-charts';
import type { ReportBrand } from '../../common/utils/report-brand';

/** Sales-rep bonuses as a presentation PDF (HTML → Chromium). Layout only. */

export interface BonusReportData {
  entries: Array<{
    rep: string;
    period: string;
    rule: string;
    amount: number;
    status: string;
    statusLabel: string;
    paidAt: string;
  }>;
  /** Applied filters, already labelled. */
  filters: string[];
}

export function bonusReportHtml(d: BonusReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const live = d.entries.filter((e) => e.status !== 'CANCELLED');
  const sum = (status?: string) =>
    live.filter((e) => !status || e.status === status).reduce((a, e) => a + e.amount, 0);
  const byRep = new Map<string, number>();
  for (const e of live) byRep.set(e.rep, (byRep.get(e.rep) ?? 0) + e.amount);

  return reportDocument({
    brand,
    title: 'تقرير مكافآت المندوبين',
    subtitle: d.filters.length ? d.filters.join(' · ') : 'كل الفترات',
    body: [
      section(
        'الملخص',
        kpiGrid([
          {
            label: 'إجمالي المكافآت',
            value: moneyText(sum(), c),
            hint: `${countText(live.length)} مكافأة · ${countText(byRep.size)} مندوب`,
          },
          {
            label: 'معلّقة',
            value: moneyText(sum('PENDING'), c),
            tone: sum('PENDING') ? 'warn' : 'default',
          },
          { label: 'معتمدة', value: moneyText(sum('APPROVED'), c) },
          { label: 'مدفوعة', value: moneyText(sum('PAID'), c), tone: 'good' },
        ]),
      ),
      section(
        'حسب المندوب',
        chartPanel(
          'إجمالي المكافآت (عدا الملغاة)',
          shareChartSvg({
            series: [...byRep].map(([label, value]) => ({ label, value })),
            color: brand.primary,
            width: CHART_FULL,
          }),
          'لا توجد مكافآت',
        ),
      ),
      section(
        'التفاصيل',
        dataTable(
          [
            { label: 'المندوب', width: 1.6 },
            { label: 'الفترة', numeric: true, width: 0.8 },
            { label: 'القاعدة', width: 1.6 },
            { label: 'المبلغ', numeric: true, width: 1.2 },
            { label: 'الحالة', width: 0.8 },
            { label: 'تاريخ الدفع', numeric: true, width: 0.9 },
          ],
          d.entries.map((e) => [
            e.rep,
            e.period,
            e.rule,
            moneyText(e.amount, c),
            e.statusLabel,
            e.paidAt || '—',
          ]),
          {
            totals: ['الإجمالي (عدا الملغاة)', '', '', moneyText(sum(), c), '', ''],
            empty: 'لا توجد مكافآت',
          },
        ),
      ),
    ].join('\n'),
  });
}
