import {
  CHART_FULL,
  CHART_HALF,
  chartPanel,
  countText,
  dataTable,
  kpiGrid,
  moneyText,
  notice,
  panelGrid,
  percentText,
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import { barChartSvg, compact, shareChartSvg } from '../../common/report-pdf/svg-charts';
import type { ReportBrand } from '../../common/utils/report-brand';
import { formatStamp } from '../../common/utils/xlsx';

/**
 * The presentation reports (HTML → PDF via ReportPdfService). Each takes the
 * same data its JSON/XLSX sibling uses — no business logic here, only layout.
 */

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardReportData {
  kpis: {
    projects: number;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits?: number;
    newLeadsThisMonth: number;
  };
  financial: {
    totalContractValue: number;
    totalCollectedVerified: number;
    overdueTotal: number;
    collectedThisMonth: number;
  };
  cashflowForecast: { next30: number; next3160: number; next6190: number };
  reservationTrend: Array<{ label: string; value: number }>;
  leadSources: Array<{ source: string; count: number }>;
  alerts: Array<[string, number]>;
  recentActivity: Array<{ action: string; title: string; context: string | null; createdAt: Date }>;
}

export function dashboardReportHtml(s: DashboardReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const k = s.kpis;
  const f = s.financial;

  const executive = kpiGrid([
    { label: 'المشاريع المنشورة', value: countText(k.projects) },
    { label: 'إجمالي الوحدات', value: countText(k.totalUnits) },
    {
      label: 'وحدات متاحة',
      value: countText(k.availableUnits),
      hint: `${percentText(k.availableUnits, k.totalUnits)} من الوحدات`,
    },
    {
      label: 'وحدات محجوزة',
      value: countText(k.reservedUnits),
      hint: `${percentText(k.reservedUnits, k.totalUnits)} من الوحدات`,
    },
    { label: 'قيمة العقود', value: moneyText(f.totalContractValue, c) },
    {
      label: 'المحصّل (موثّق)',
      value: moneyText(f.totalCollectedVerified, c),
      hint: `${percentText(f.totalCollectedVerified, f.totalContractValue)} من قيمة العقود`,
    },
    {
      label: 'المتأخرات',
      value: moneyText(f.overdueTotal, c),
      tone: f.overdueTotal > 0 ? 'warn' : 'default',
    },
    { label: 'فرص جديدة هذا الشهر', value: countText(k.newLeadsThisMonth) },
  ]);

  const charts = panelGrid(
    chartPanel(
      'اتجاه الحجوزات (آخر 6 أشهر)',
      barChartSvg({
        series: s.reservationTrend.map((t) => ({ label: t.label, value: t.value })),
        color: brand.primary,
        width: CHART_HALF,
        height: 190,
      }),
    ),
    chartPanel(
      'مصادر العملاء المحتملين',
      shareChartSvg({
        series: s.leadSources.map((l) => ({ label: l.source, value: l.count })),
        color: brand.primary,
        width: CHART_HALF,
      }),
    ),
  );

  const cashflow = kpiGrid(
    [
      { label: 'خلال 30 يوماً', value: moneyText(s.cashflowForecast.next30, c) },
      { label: 'من 31 إلى 60 يوماً', value: moneyText(s.cashflowForecast.next3160, c) },
      { label: 'من 61 إلى 90 يوماً', value: moneyText(s.cashflowForecast.next6190, c) },
    ],
    3,
  );

  const alerts = s.alerts.length
    ? kpiGrid(
        s.alerts.map(([label, n]) => ({ label, value: countText(n), tone: 'warn' as const })),
        3,
      )
    : notice('لا توجد تنبيهات معلقة');

  const activity = dataTable(
    [
      { label: 'النشاط', width: 1.1 },
      { label: 'الجهة', width: 1.6 },
      { label: 'السياق', width: 1.2, numeric: true },
      { label: 'التاريخ', width: 1.1, numeric: true },
    ],
    s.recentActivity.map((a) => [
      a.action,
      a.title,
      a.context ?? '—',
      formatStamp(a.createdAt, brand.timezone),
    ]),
    { empty: 'لا توجد نشاطات حديثة' },
  );

  return reportDocument({
    brand,
    title: 'تقرير لوحة التحكم',
    subtitle: 'ملخص تنفيذي للمخزون والمبيعات والتحصيل',
    body: [
      section('الملخص التنفيذي', executive),
      section('المؤشرات', charts),
      section('التحصيل المتوقع', cashflow, 'أقساط مستحقة لم تُدفع بعد'),
      section('التنبيهات المعلقة', alerts),
      section('آخر النشاطات', activity),
    ].join('\n'),
  });
}

// ── Sales ────────────────────────────────────────────────────────────────────

export interface SalesReportData {
  contracts: number;
  total: number;
  byProject: Array<{ name: string; count: number; total: number }>;
  periodLabel: string;
}

export function salesReportHtml(d: SalesReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const rows = [...d.byProject].sort((a, b) => b.total - a.total);
  return reportDocument({
    brand,
    title: 'تقرير المبيعات',
    subtitle: `الفترة: ${d.periodLabel}`,
    body: [
      section(
        'الملخص',
        kpiGrid([
          { label: 'عدد العقود', value: countText(d.contracts) },
          { label: 'إجمالي قيمة المبيعات', value: moneyText(d.total, c) },
          {
            label: 'متوسط قيمة العقد',
            value: d.contracts ? moneyText(Math.round(d.total / d.contracts), c) : '—',
          },
          { label: 'المشاريع', value: countText(rows.length) },
        ]),
      ),
      section(
        'المبيعات حسب المشروع',
        chartPanel(
          'قيمة المبيعات',
          shareChartSvg({
            series: rows.map((p) => ({ label: p.name, value: p.total })),
            color: brand.primary,
            width: CHART_FULL,
          }),
        ),
      ),
      section(
        'التفاصيل',
        dataTable(
          [
            { label: 'المشروع', width: 2.4 },
            { label: 'عدد العقود', numeric: true },
            { label: 'إجمالي القيمة', numeric: true, width: 1.6 },
            { label: 'الحصة', numeric: true, width: 0.8 },
          ],
          rows.map((p) => [
            p.name,
            countText(p.count),
            moneyText(p.total, c),
            percentText(p.total, d.total),
          ]),
          {
            totals: [
              'الإجمالي',
              countText(d.contracts),
              moneyText(d.total, c),
              d.total ? '100%' : '—',
            ],
            empty: 'لا توجد مبيعات في هذه الفترة',
          },
        ),
      ),
    ].join('\n'),
  });
}

// ── Financial ────────────────────────────────────────────────────────────────

export interface FinancialReportData {
  deposits: number;
  verified: number;
  total: number;
  periodLabel: string;
}

export function financialReportHtml(d: FinancialReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const unverified = Math.max(0, d.deposits - d.verified);
  return reportDocument({
    brand,
    title: 'التقرير المالي',
    subtitle: `الفترة: ${d.periodLabel}`,
    body: [
      section(
        'الملخص',
        kpiGrid([
          { label: 'إجمالي المحصّل', value: moneyText(d.total, c) },
          { label: 'عدد الدفعات', value: countText(d.deposits) },
          { label: 'الدفعات الموثّقة', value: countText(d.verified), tone: 'good' },
          {
            label: 'بانتظار التوثيق',
            value: countText(unverified),
            tone: unverified ? 'warn' : 'default',
          },
        ]),
      ),
      section(
        'حالة التوثيق',
        chartPanel(
          `نسبة التوثيق ${percentText(d.verified, d.deposits)}`,
          shareChartSvg({
            series: [
              { label: 'موثّقة', value: d.verified },
              { label: 'بانتظار التوثيق', value: unverified },
            ],
            color: brand.primary,
            width: CHART_FULL,
          }),
        ),
      ),
      section(
        'التفاصيل',
        dataTable(
          [
            { label: 'البيان', width: 2 },
            { label: 'القيمة', numeric: true },
          ],
          [
            ['إجمالي المبالغ المحصّلة', moneyText(d.total, c)],
            ['متوسط الدفعة', d.deposits ? moneyText(Math.round(d.total / d.deposits), c) : '—'],
            ['الدفعات الموثّقة', countText(d.verified)],
            ['الدفعات بانتظار التوثيق', countText(unverified)],
            ['عدد الدفعات الكلي', countText(d.deposits)],
          ],
        ),
      ),
    ].join('\n'),
  });
}

// ── Brokers ──────────────────────────────────────────────────────────────────

export interface BrokerReportData {
  brokers: Array<{ brokerName: string; count: number; commissionAmount: number }>;
  periodLabel: string;
}

export function brokerReportHtml(d: BrokerReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const rows = [...d.brokers].sort((a, b) => b.commissionAmount - a.commissionAmount);
  const total = rows.reduce((a, b) => a + b.commissionAmount, 0);
  const count = rows.reduce((a, b) => a + b.count, 0);
  return reportDocument({
    brand,
    title: 'تقرير الوسطاء',
    subtitle: `الفترة: ${d.periodLabel}`,
    body: [
      section(
        'الملخص',
        kpiGrid([
          { label: 'عدد الوسطاء', value: countText(rows.length) },
          { label: 'عدد العمولات', value: countText(count) },
          { label: 'إجمالي العمولات', value: moneyText(total, c) },
          { label: 'متوسط العمولة', value: count ? moneyText(Math.round(total / count), c) : '—' },
        ]),
      ),
      section(
        'أعلى الوسطاء',
        chartPanel(
          'حسب إجمالي العمولات',
          shareChartSvg({
            series: rows.map((b) => ({ label: b.brokerName, value: b.commissionAmount })),
            color: brand.primary,
            format: compact,
            width: CHART_FULL,
          }),
        ),
      ),
      section(
        'الترتيب',
        dataTable(
          [
            { label: '#', numeric: true, width: 0.4 },
            { label: 'الوسيط', width: 2.4 },
            { label: 'العمولات', numeric: true },
            { label: 'الإجمالي', numeric: true, width: 1.5 },
            { label: 'الحصة', numeric: true, width: 0.8 },
          ],
          rows.map((b, i) => [
            i + 1,
            b.brokerName,
            countText(b.count),
            moneyText(b.commissionAmount, c),
            percentText(b.commissionAmount, total),
          ]),
          {
            totals: ['', 'الإجمالي', countText(count), moneyText(total, c), total ? '100%' : '—'],
            empty: 'لا توجد عمولات في هذه الفترة',
          },
        ),
      ),
    ].join('\n'),
  });
}
