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

// ── Operational ──────────────────────────────────────────────────────────────

const RESERVATION_STATUS_AR: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'معتمدة',
  REJECTED: 'مرفوضة',
  CANCELLED: 'ملغاة',
  EXPIRED: 'منتهية',
  CONVERTED: 'تحوّلت إلى عقد',
};

export interface OperationalReportData {
  projects: number;
  units: { total: number; available: number; reserved: number; sold: number };
  leads: { total: number; new: number };
  pendingVisits: number;
  contracts: number;
  depositsTotal: number;
  reservationsByStatus: Record<string, number>;
}

export function operationalReportHtml(d: OperationalReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const u = d.units;
  const reservations = Object.entries(d.reservationsByStatus).map(([status, n]) => ({
    label: RESERVATION_STATUS_AR[status] ?? status,
    value: n,
  }));
  const reservationsTotal = reservations.reduce((a, r) => a + r.value, 0);
  return reportDocument({
    brand,
    title: 'التقرير التشغيلي',
    subtitle: 'المخزون والعملاء والحجوزات والتحصيل',
    body: [
      section(
        'المخزون',
        kpiGrid([
          { label: 'المشاريع المنشورة', value: countText(d.projects) },
          { label: 'إجمالي الوحدات', value: countText(u.total) },
          {
            label: 'وحدات متاحة',
            value: countText(u.available),
            hint: `${percentText(u.available, u.total)} من الوحدات`,
          },
          {
            label: 'وحدات مباعة',
            value: countText(u.sold),
            hint: `${percentText(u.sold, u.total)} من الوحدات`,
          },
        ]),
      ),
      section(
        'المبيعات والعملاء',
        kpiGrid([
          { label: 'وحدات محجوزة', value: countText(u.reserved) },
          { label: 'عدد العقود', value: countText(d.contracts) },
          {
            label: 'العملاء المحتملون',
            value: countText(d.leads.total),
            hint: `${countText(d.leads.new)} جديد`,
          },
          {
            label: 'زيارات قيد الانتظار',
            value: countText(d.pendingVisits),
            tone: d.pendingVisits ? 'warn' : 'default',
          },
        ]),
      ),
      section(
        'التحصيل',
        kpiGrid([{ label: 'إجمالي الدفعات المحصّلة', value: moneyText(d.depositsTotal, c) }], 2),
      ),
      section(
        'الحجوزات حسب الحالة',
        panelGrid(
          chartPanel(
            'توزيع الحجوزات',
            shareChartSvg({ series: reservations, color: brand.primary, width: CHART_HALF }),
          ),
          dataTable(
            [
              { label: 'الحالة', width: 2 },
              { label: 'العدد', numeric: true },
              { label: 'الحصة', numeric: true },
            ],
            reservations.map((r) => [
              r.label,
              countText(r.value),
              percentText(r.value, reservationsTotal),
            ]),
            {
              totals: ['الإجمالي', countText(reservationsTotal), reservationsTotal ? '100%' : '—'],
              empty: 'لا توجد حجوزات',
            },
          ),
        ),
      ),
    ].join('\n'),
  });
}

// ── Financial dashboard ──────────────────────────────────────────────────────

export const DEPOSIT_TYPE_AR: Record<string, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

export const AGING_AR: Record<string, string> = {
  '1-30': '1-30 يوم',
  '31-60': '31-60 يوم',
  '61-90': '61-90 يوم',
  '90+': '90+ يوم',
};

type Amount = number | string;

export interface FinancialDashboardReportData {
  summary: {
    totalContractValue: Amount;
    totalCollectedVerified: Amount;
    totalCollectedUnverified: Amount;
    totalOutstanding: Amount;
    collectedThisMonth: Amount;
    dueThisMonth: Amount;
    contractCount: number;
    depositCount: number;
    dueSoonAmount: Amount;
    overdueAmountComputed: Amount;
    overdueInstallmentCountComputed: number;
  };
  unpaidLiabilities: Amount;
  collectionByType: Array<{
    type: string;
    count: number;
    totalAll: Amount;
    totalVerified: Amount;
    totalUnverified: Amount;
  }>;
  aging: Array<{ label: string; count: number; amount: Amount }>;
  /** Applied filters, already labelled ("المشروع: …"). */
  filters: string[];
}

export function financialDashboardReportHtml(
  d: FinancialDashboardReportData,
  brand: ReportBrand,
): string {
  const c = brand.currency;
  const s = d.summary;
  const n = (v: Amount) => Number(v) || 0;
  const risks = [
    { label: 'مستحق خلال 7 أيام', value: n(s.dueSoonAmount), money: true },
    { label: 'المتأخر', value: n(s.overdueAmountComputed), money: true },
    { label: 'أقساط متأخرة', value: s.overdueInstallmentCountComputed, money: false },
    { label: 'التزامات غير مدفوعة', value: n(d.unpaidLiabilities), money: true },
  ].filter((r) => r.value > 0);
  const byType = d.collectionByType.map((t) => ({
    ...t,
    label: DEPOSIT_TYPE_AR[t.type] ?? t.type,
  }));
  const typeTotal = byType.reduce((a, t) => a + n(t.totalAll), 0);

  return reportDocument({
    brand,
    title: 'لوحة المؤشرات المالية',
    subtitle: d.filters.length ? d.filters.join(' · ') : 'كل المشاريع وكل الفترات',
    body: [
      section(
        'الملخص التنفيذي',
        kpiGrid([
          {
            label: 'إجمالي قيمة العقود',
            value: moneyText(n(s.totalContractValue), c),
            hint: `${countText(s.contractCount)} عقد`,
          },
          {
            label: 'المحصّل المؤكد',
            value: moneyText(n(s.totalCollectedVerified), c),
            hint: `${percentText(n(s.totalCollectedVerified), n(s.totalContractValue))} من قيمة العقود`,
            tone: 'good',
          },
          { label: 'المحصّل غير المؤكد', value: moneyText(n(s.totalCollectedUnverified), c) },
          { label: 'المتبقي للتحصيل', value: moneyText(n(s.totalOutstanding), c) },
          { label: 'المحصّل هذا الشهر', value: moneyText(n(s.collectedThisMonth), c) },
          { label: 'المستحق هذا الشهر', value: moneyText(n(s.dueThisMonth), c) },
          { label: 'عدد الدفعات', value: countText(s.depositCount) },
          { label: 'عدد العقود', value: countText(s.contractCount) },
        ]),
      ),
      section(
        'التنبيهات والمخاطر',
        risks.length
          ? kpiGrid(
              risks.map((r) => ({
                label: r.label,
                value: r.money ? moneyText(r.value, c) : countText(r.value),
                tone: 'warn' as const,
              })),
            )
          : notice('لا توجد متأخرات أو مستحقات عاجلة'),
      ),
      section(
        'المؤشرات',
        panelGrid(
          chartPanel(
            'أعمار المتأخرات',
            d.aging.some((a) => n(a.amount) > 0)
              ? barChartSvg({
                  series: d.aging.map((a) => ({
                    label: AGING_AR[a.label] ?? a.label,
                    value: n(a.amount),
                  })),
                  color: brand.primary,
                  width: CHART_HALF,
                  height: 190,
                })
              : '',
            'لا توجد متأخرات',
          ),
          chartPanel(
            'التحصيل حسب نوع الدفعة',
            shareChartSvg({
              series: byType.map((t) => ({ label: t.label, value: n(t.totalAll) })),
              color: brand.primary,
              width: CHART_HALF,
            }),
          ),
        ),
      ),
      section(
        'التحصيل حسب النوع',
        dataTable(
          [
            { label: 'النوع', width: 1.6 },
            { label: 'العدد', numeric: true, width: 0.7 },
            { label: 'الإجمالي', numeric: true, width: 1.4 },
            { label: 'المؤكد', numeric: true, width: 1.4 },
            { label: 'غير المؤكد', numeric: true, width: 1.4 },
          ],
          byType.map((t) => [
            t.label,
            countText(t.count),
            moneyText(n(t.totalAll), c),
            moneyText(n(t.totalVerified), c),
            moneyText(n(t.totalUnverified), c),
          ]),
          {
            totals: [
              'الإجمالي',
              countText(byType.reduce((a, t) => a + t.count, 0)),
              moneyText(typeTotal, c),
              moneyText(
                byType.reduce((a, t) => a + n(t.totalVerified), 0),
                c,
              ),
              moneyText(
                byType.reduce((a, t) => a + n(t.totalUnverified), 0),
                c,
              ),
            ],
            empty: 'لا توجد دفعات',
          },
        ),
      ),
      section(
        'أعمار المتأخرات',
        dataTable(
          [
            { label: 'الفئة', width: 1.6 },
            { label: 'عدد الأقساط', numeric: true },
            { label: 'المبلغ', numeric: true, width: 1.4 },
          ],
          d.aging.map((a) => [
            AGING_AR[a.label] ?? a.label,
            countText(a.count),
            moneyText(n(a.amount), c),
          ]),
          { empty: 'لا توجد متأخرات' },
        ),
      ),
    ].join('\n'),
  });
}
