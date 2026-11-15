import {
  CHART_FULL,
  CHART_HALF,
  chartPanel,
  countText,
  dataTable,
  kpiGrid,
  panelGrid,
  percentText,
  reportDocument,
  section,
} from '../../common/report-pdf/report-html';
import { shareChartSvg } from '../../common/report-pdf/svg-charts';
import type { ReportBrand } from '../../common/utils/report-brand';

/**
 * The maintenance report as a presentation PDF (HTML → Chromium). Same data
 * as the XLSX (`reportsSummary`); layout only.
 */

export interface MaintenanceReportData {
  totalRequests: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  overdueCount: number;
  inWarrantyCount: number;
  outOfWarrantyCount: number;
  unknownWarrantyCount: number;
  avgResolutionHours: number | null;
  resolvedWithinSlaCount: number;
  resolvedOverdueCount: number;
  slaAttainmentPercent: number | null;
  avgDelayHours: number | null;
  byCategory: Array<{
    name: string;
    count: number;
    overdueCount: number;
    outOfWarrantyCount: number;
  }>;
  byAssignee: Array<{ name: string; count: number; overdueCount: number; inProgressCount: number }>;
  expiringWarranties: Array<{ unitCode: string; category: string; warrantyEnd: string }>;
  /** Applied filters, already labelled ("الحالة: مفتوحة"). */
  filters: string[];
  /** The open requests, one line each. */
  open?: OpenRequestLine[];
  /** Formats a timestamp as the company's calendar day. */
  day?: (d: Date) => string;
}

const OPEN_PDF_ROWS = 300;

const PRIORITY_AR: Record<string, string> = { LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة' };
const OPEN_STATUS_AR: Record<string, string> = { OPEN: 'مفتوحة', ASSIGNED: 'مسندة', IN_PROGRESS: 'قيد التنفيذ' };
const DAY = 86_400_000;

const arName = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const t = v as { ar?: string; en?: string };
  return t.ar || t.en || '';
};

export interface OpenRequestLine {
  createdAt: Date;
  customer: string;
  phone: string;
  unit: string;
  project: string;
  category: string;
  priority: string;
  status: string;
  assignee: string;
  dueAt: Date | null;
  daysOpen: number;
  /** Days past the due date (0 when not due or no due date). */
  daysLate: number;
  complaint: boolean;
  description: string;
}

/** One line per open request (the service fetched them with the report's filters). */
export function openRequestLines(
  rows: Array<{
    createdAt: Date;
    status: string;
    reviewStatus: string;
    priority: string | null;
    dueAt: Date | null;
    description: string;
    complaintAt: Date | null;
    customer: { fullName: string | null; phone?: string | null } | null;
    unit: { code: string | null; building?: { phase?: { project?: { name: unknown } | null } | null } | null } | null;
    category: { name: unknown } | null;
    items: Array<{ category: { name: unknown } | null }>;
    assignedAdmin: { fullName: string | null } | null;
  }>,
  now: Date,
): OpenRequestLine[] {
  return rows
    .map((r) => {
      const cats = [...new Set(r.items.map((i) => arName(i.category?.name)).filter(Boolean))];
      const late = r.dueAt && r.dueAt < now ? Math.floor((now.getTime() - r.dueAt.getTime()) / DAY) : 0;
      const text = r.description.replace(/\s+/g, ' ').trim();
      return {
        createdAt: r.createdAt,
        customer: r.customer?.fullName ?? '—',
        phone: r.customer?.phone ?? '',
        unit: r.unit?.code ?? '—',
        project: arName(r.unit?.building?.phase?.project?.name) || '—',
        category: cats.length ? cats.join('، ') : arName(r.category?.name) || '—',
        priority: r.priority ? (PRIORITY_AR[r.priority] ?? r.priority) : '—',
        // Awaiting approval reads as such whatever its status.
        status: r.reviewStatus === 'PENDING' ? 'قيد المراجعة' : (OPEN_STATUS_AR[r.status] ?? r.status),
        assignee: r.assignedAdmin?.fullName ?? 'غير مسند',
        dueAt: r.dueAt,
        daysOpen: Math.max(0, Math.floor((now.getTime() - r.createdAt.getTime()) / DAY)),
        daysLate: late,
        complaint: Boolean(r.complaintAt),
        description: text.length > 80 ? `${text.slice(0, 79)}…` : text,
      };
    })
    .sort((a, b) => b.daysLate - a.daysLate || +a.createdAt - +b.createdAt);
}

const hours = (v: number | null) => {
  if (v == null) return '—';
  if (v < 1) return 'أقل من ساعة';
  if (v >= 48) return `${Math.round((v / 24) * 10) / 10} يوم`;
  return `${Math.round(v * 10) / 10} ساعة`;
};

export function maintenanceReportHtml(d: MaintenanceReportData, brand: ReportBrand): string {
  const status = [
    { label: 'مفتوحة', value: d.openCount },
    { label: 'مسندة', value: d.assignedCount },
    { label: 'قيد التنفيذ', value: d.inProgressCount },
    { label: 'تم الحل', value: d.resolvedCount },
    { label: 'مغلقة', value: d.closedCount },
  ];
  const warranty = [
    { label: 'تحت الضمان', value: d.inWarrantyCount },
    { label: 'خارج الضمان', value: d.outOfWarrantyCount },
    { label: 'غير معروف', value: d.unknownWarrantyCount },
  ];
  const sla = d.slaAttainmentPercent;
  const knownWarranty = d.inWarrantyCount + d.outOfWarrantyCount > 0;

  return reportDocument({
    brand,
    title: 'تقرير الصيانة',
    subtitle: d.filters.length ? d.filters.join(' · ') : 'كل الطلبات',
    // The open requests list is wide: the page is sideways.
    landscape: Boolean(d.open),
    body: [
      section(
        'الملخص',
        kpiGrid([
          { label: 'إجمالي الطلبات', value: countText(d.totalRequests) },
          {
            label: 'قيد المراجعة',
            value: countText(d.pendingReviewCount),
            tone: d.pendingReviewCount ? 'warn' : 'default',
          },
          {
            label: 'متأخرة',
            value: countText(d.overdueCount),
            tone: d.overdueCount ? 'warn' : 'default',
          },
          {
            label: 'الالتزام بالمدة',
            value: sla == null ? '—' : `${Math.round(sla)}%`,
            hint: `${countText(d.resolvedWithinSlaCount)} ضمن المدة · ${countText(d.resolvedOverdueCount)} بعدها`,
            tone: sla == null ? 'default' : sla >= 80 ? 'good' : 'warn',
          },
          { label: 'متوسط زمن المعالجة', value: hours(d.avgResolutionHours) },
          { label: 'متوسط التأخير', value: hours(d.avgDelayHours) },
          { label: 'معتمدة', value: countText(d.approvedCount) },
          { label: 'مرفوضة', value: countText(d.rejectedCount) },
        ]),
      ),
      section(
        'التوزيع',
        panelGrid(
          chartPanel(
            'حسب الحالة',
            shareChartSvg({
              series: status,
              color: brand.primary,
              width: knownWarranty ? CHART_HALF : CHART_FULL,
              format: countText,
            }),
          ),
          // Only when some request has a known warranty: a chart that is all
          // «غير معروف» says nothing.
          ...(knownWarranty
            ? [
                chartPanel(
                  'حسب الضمان',
                  shareChartSvg({
                    series: warranty,
                    color: brand.primary,
                    width: CHART_HALF,
                    format: countText,
                  }),
                ),
              ]
            : []),
        ),
      ),
      section(
        'حسب الفئة',
        dataTable(
          [
            { label: 'الفئة', width: 2 },
            { label: 'العدد', numeric: true },
            { label: 'الحصة', numeric: true },
            { label: 'متأخرة', numeric: true },
            { label: 'خارج الضمان', numeric: true },
          ],
          d.byCategory.map((r) => [
            r.name,
            countText(r.count),
            percentText(r.count, d.totalRequests),
            countText(r.overdueCount),
            countText(r.outOfWarrantyCount),
          ]),
          { empty: 'لا توجد طلبات' },
        ),
      ),
      section(
        'حسب المسند إليه',
        dataTable(
          [
            { label: 'المسند إليه', width: 2 },
            { label: 'العدد', numeric: true },
            { label: 'قيد التنفيذ', numeric: true },
            { label: 'متأخرة', numeric: true },
          ],
          d.byAssignee.map((r) => [
            r.name,
            countText(r.count),
            countText(r.inProgressCount),
            countText(r.overdueCount),
          ]),
          { empty: 'لا توجد طلبات مسندة' },
        ),
      ),
      section(
        'ضمانات تنتهي قريباً',
        dataTable(
          [
            { label: 'الوحدة', numeric: true },
            { label: 'الفئة', width: 2 },
            { label: 'نهاية الضمان', numeric: true },
          ],
          d.expiringWarranties.map((w) => [w.unitCode, w.category, w.warrantyEnd]),
          { empty: 'لا توجد ضمانات تنتهي قريباً' },
        ),
      ),
      ...(d.open ? [openRequestsSection(d.open, d.day ?? ((x) => x.toISOString().slice(0, 10)))] : []),
    ].join('\n'),
  });
}

function openRequestsSection(open: OpenRequestLine[], day: (d: Date) => string): string {
  const shown = open.slice(0, OPEN_PDF_ROWS);
  const late = open.filter((r) => r.daysLate > 0).length;
  return section(
    'الطلبات المفتوحة',
    dataTable(
      [
        { label: 'تاريخ الطلب', numeric: true, width: 0.95 },
        { label: 'العميل', width: 1.4 },
        { label: 'الهاتف', numeric: true, width: 1.2 },
        { label: 'الوحدة', width: 1.15 },
        { label: 'الفئة', width: 1.2 },
        { label: 'الأولوية', width: 0.75 },
        { label: 'الحالة', width: 0.9 },
        { label: 'المسند إليه', width: 1.15 },
        { label: 'الموعد', numeric: true, width: 0.95 },
        { label: 'التأخير (يوم)', numeric: true, width: 0.8 },
        { label: 'الوصف', width: 2 },
      ],
      shown.map((r) => [
        day(r.createdAt),
        r.complaint ? `${r.customer} (شكوى)` : r.customer,
        r.phone || '—',
        r.unit,
        r.category,
        r.priority,
        r.status,
        r.assignee,
        r.dueAt ? day(r.dueAt) : '—',
        r.daysLate ? countText(r.daysLate) : '—',
        r.description,
      ]),
      {
        totals: ['الإجمالي', countText(open.length), '', '', '', '', '', '', 'متأخرة', countText(late), ''],
        empty: 'لا توجد طلبات مفتوحة',
      },
    ),
    open.length > shown.length
      ? `أول ${countText(shown.length)} من ${countText(open.length)} — القائمة كاملة في ملف Excel`
      : 'الأكثر تأخيرًا أولًا',
  );
}
