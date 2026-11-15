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
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import { barChartSvg, shareChartSvg } from '../../common/report-pdf/svg-charts';
import type { ReportBrand } from '../../common/utils/report-brand';

/**
 * Broker presentation reports (HTML → PDF via ReportPdfService): the firm-wide
 * summary, the top-brokers ranking and one broker's performance (also the
 * broker portal's «أدائي»). Same data as the XLSX twins; layout only.
 */

type Amount = number | string;
const n = (v: Amount) => Number(v) || 0;
const rate = (v: number) => `${Math.round((v || 0) * 100)}%`;

export const BROKER_STATUS_AR: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  TERMINATED: 'منتهي التعاقد',
};

export interface BrokerSummaryData {
  totalBrokers: number;
  activeBrokers: number;
  totalBrokerAgents: number;
  leadsSubmitted: number;
  leadsApproved: number;
  reservationsCreated: number;
  contractsSigned: number;
  salesGross: Amount;
  commissionsNet: Amount;
  payoutsTotalNet: Amount;
  leadToReservationRate: number;
  reservationToContractRate: number;
  signedContractRate: number;
  contractToPaidPayoutRate: number;
}

export interface TopBrokerRow {
  companyName: string;
  code: string;
  status: string;
  leads: number;
  approvedLeads: number;
  reservations: number;
  contracts: number;
  contractsSigned: number;
  salesGross: Amount;
  commissionGross: Amount;
  commissionNet: Amount;
  payoutNet: Amount;
  conversionRate: number;
}

function funnel(s: BrokerSummaryData): string {
  return kpiGrid([
    { label: 'الفرصة ← الحجز', value: rate(s.leadToReservationRate) },
    { label: 'الحجز ← العقد', value: rate(s.reservationToContractRate) },
    { label: 'العقود الموقّعة', value: rate(s.signedContractRate) },
    { label: 'العقد ← الدفع', value: rate(s.contractToPaidPayoutRate) },
  ]);
}

// ── Firm-wide summary ────────────────────────────────────────────────────────

export function brokerSummaryReportHtml(
  d: { summary: BrokerSummaryData; top: TopBrokerRow[]; periodLabel: string },
  brand: ReportBrand,
): string {
  const c = brand.currency;
  const s = d.summary;
  return reportDocument({
    brand,
    title: 'تقرير أداء الوسطاء',
    // Wide ranking table: printed sideways like the HR summaries.
    landscape: true,
    subtitle: `الفترة: ${d.periodLabel}`,
    body: [
      section(
        'الملخص التنفيذي',
        kpiGrid([
          {
            label: 'الوسطاء',
            value: countText(s.totalBrokers),
            hint: `${countText(s.activeBrokers)} نشط`,
          },
          { label: 'وكلاء الوسطاء', value: countText(s.totalBrokerAgents) },
          {
            label: 'الفرص المرسلة',
            value: countText(s.leadsSubmitted),
            hint: `${countText(s.leadsApproved)} معتمدة`,
          },
          { label: 'الحجوزات', value: countText(s.reservationsCreated) },
          { label: 'العقود الموقّعة', value: countText(s.contractsSigned) },
          { label: 'إجمالي المبيعات', value: moneyText(n(s.salesGross), c) },
          { label: 'صافي العمولات', value: moneyText(n(s.commissionsNet), c) },
          { label: 'صافي المدفوعات', value: moneyText(n(s.payoutsTotalNet), c) },
        ]),
      ),
      section('معدلات التحويل', funnel(s)),
      section(
        'أعلى الوسطاء حسب المبيعات',
        chartPanel(
          'إجمالي المبيعات',
          shareChartSvg({
            series: d.top.slice(0, 10).map((b) => ({ label: b.companyName, value: n(b.salesGross) })),
            color: brand.primary,
            width: CHART_FULL,
          }),
          'لا توجد مبيعات للوسطاء في هذه الفترة',
        ),
      ),
      section(
        'الترتيب',
        dataTable(
          [
            { label: '#', numeric: true, width: 0.35 },
            { label: 'الوسيط', width: 1.8 },
            { label: 'الكود', numeric: true, width: 0.9 },
            { label: 'الحالة', width: 0.7 },
            { label: 'فرص', numeric: true, width: 0.55 },
            { label: 'حجوزات', numeric: true, width: 0.65 },
            { label: 'عقود موقّعة', numeric: true, width: 0.75 },
            { label: 'المبيعات', numeric: true, width: 1.3 },
            { label: 'صافي العمولات', numeric: true, width: 1.2 },
            { label: 'صافي المدفوعات', numeric: true, width: 1.2 },
            { label: 'التحويل', numeric: true, width: 0.6 },
          ],
          d.top.map((b, i) => [
            i + 1,
            b.companyName,
            b.code,
            BROKER_STATUS_AR[b.status] ?? b.status,
            countText(b.leads),
            countText(b.reservations),
            countText(b.contractsSigned),
            moneyText(n(b.salesGross), c),
            moneyText(n(b.commissionNet), c),
            moneyText(n(b.payoutNet), c),
            rate(b.conversionRate),
          ]),
          {
            empty: 'لا توجد بيانات',
            totals: d.top.length
              ? [
                  '',
                  'الإجمالي',
                  '',
                  '',
                  countText(d.top.reduce((a, b) => a + b.leads, 0)),
                  countText(d.top.reduce((a, b) => a + b.reservations, 0)),
                  countText(d.top.reduce((a, b) => a + b.contractsSigned, 0)),
                  moneyText(d.top.reduce((a, b) => a + n(b.salesGross), 0), c),
                  moneyText(d.top.reduce((a, b) => a + n(b.commissionNet), 0), c),
                  moneyText(d.top.reduce((a, b) => a + n(b.payoutNet), 0), c),
                  '',
                ]
              : undefined,
          },
        ),
      ),
    ].join('\n'),
  });
}

// ── One broker ───────────────────────────────────────────────────────────────

export interface BrokerDetailReportData {
  broker: { name: string; code: string; status: string };
  summary: BrokerSummaryData & { contractsCreated: number };
  monthlyTrend: Array<{
    label: string;
    reservations: number;
    contractsSigned: number;
    commissionsNet: Amount;
    payoutsNet: Amount;
  }>;
  agents: Array<{
    fullName: string;
    leadsSubmitted: number;
    reservations: number;
    contractsSigned: number;
    salesGross: Amount;
    commissionNet: Amount;
  }>;
  projects: Array<{
    name: string;
    city: string;
    contractsSigned: number;
    salesGross: Amount;
    commissionNet: Amount;
  }>;
  periodLabel: string;
  /** «أدائي» in the broker portal: titled for the agent rather than the firm. */
  title?: string;
}

export function brokerDetailReportHtml(d: BrokerDetailReportData, brand: ReportBrand): string {
  const c = brand.currency;
  const s = d.summary;
  const trend = d.monthlyTrend;
  return reportDocument({
    brand,
    title: d.title ?? `تقرير الوسيط — ${d.broker.name}`,
    subtitle: `الفترة: ${d.periodLabel}`,
    meta: [
      ['الكود', d.broker.code],
      ['الحالة', BROKER_STATUS_AR[d.broker.status] ?? d.broker.status],
    ],
    body: [
      section(
        'الملخص',
        kpiGrid(
          [
            {
              label: 'الفرص المرسلة',
              value: countText(s.leadsSubmitted),
              hint: `${countText(s.leadsApproved)} معتمدة`,
            },
            { label: 'الحجوزات', value: countText(s.reservationsCreated) },
            {
              label: 'العقود',
              value: countText(s.contractsCreated),
              hint: `${countText(s.contractsSigned)} موقّعة`,
            },
            { label: 'إجمالي المبيعات', value: moneyText(n(s.salesGross), c) },
            { label: 'صافي العمولات', value: moneyText(n(s.commissionsNet), c) },
            { label: 'صافي المدفوعات', value: moneyText(n(s.payoutsTotalNet), c) },
          ],
          3,
        ),
      ),
      section('معدلات التحويل', funnel(s)),
      section(
        'الاتجاه الشهري',
        trend.some((t) => t.contractsSigned || n(t.commissionsNet))
          ? panelGrid(
              chartPanel(
                'العقود الموقّعة',
                barChartSvg({
                  series: trend.map((t) => ({ label: t.label, value: t.contractsSigned })),
                  color: brand.primary,
                  width: CHART_HALF,
                  height: 190,
                  format: (v) => countText(v),
                }),
              ),
              chartPanel(
                'صافي العمولات',
                barChartSvg({
                  series: trend.map((t) => ({ label: t.label, value: n(t.commissionsNet) })),
                  color: brand.primary,
                  width: CHART_HALF,
                  height: 190,
                }),
              ),
            )
          : notice('لا يوجد نشاط في هذه الفترة', 'muted'),
      ),
      section(
        'الوكلاء',
        dataTable(
          [
            { label: 'الوكيل', width: 2 },
            { label: 'فرص', numeric: true, width: 0.7 },
            { label: 'حجوزات', numeric: true, width: 0.8 },
            { label: 'عقود موقّعة', numeric: true, width: 0.9 },
            { label: 'المبيعات', numeric: true, width: 1.4 },
            { label: 'صافي العمولات', numeric: true, width: 1.3 },
          ],
          d.agents.map((a) => [
            a.fullName,
            countText(a.leadsSubmitted),
            countText(a.reservations),
            countText(a.contractsSigned),
            moneyText(n(a.salesGross), c),
            moneyText(n(a.commissionNet), c),
          ]),
          { empty: 'لا يوجد وكلاء' },
        ),
      ),
      section(
        'المشاريع',
        dataTable(
          [
            { label: 'المشروع', width: 2 },
            { label: 'المدينة', width: 1 },
            { label: 'عقود موقّعة', numeric: true, width: 0.9 },
            { label: 'المبيعات', numeric: true, width: 1.4 },
            { label: 'صافي العمولات', numeric: true, width: 1.3 },
          ],
          d.projects.map((p) => [
            p.name,
            p.city || '—',
            countText(p.contractsSigned),
            moneyText(n(p.salesGross), c),
            moneyText(n(p.commissionNet), c),
          ]),
          { empty: 'لا توجد مشاريع' },
        ),
      ),
      ...(d.monthlyTrend.length
        ? [
            section(
              'التفاصيل الشهرية',
              dataTable(
                [
                  { label: 'الشهر', numeric: true },
                  { label: 'حجوزات', numeric: true },
                  { label: 'عقود موقّعة', numeric: true },
                  { label: 'صافي العمولات', numeric: true, width: 1.4 },
                  { label: 'صافي المدفوعات', numeric: true, width: 1.4 },
                ],
                trend.map((t) => [
                  t.label,
                  countText(t.reservations),
                  countText(t.contractsSigned),
                  moneyText(n(t.commissionsNet), c),
                  moneyText(n(t.payoutsNet), c),
                ]),
              ),
            ),
          ]
        : []),
    ].join('\n'),
  });
}
