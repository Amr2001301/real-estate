import {
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
}

const hours = (v: number | null) => (v == null ? '—' : `${Math.round(v * 10) / 10} ساعة`);

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

  return reportDocument({
    brand,
    title: 'تقرير الصيانة',
    subtitle: d.filters.length ? d.filters.join(' · ') : 'كل الطلبات',
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
              width: CHART_HALF,
              format: countText,
            }),
          ),
          chartPanel(
            'حسب الضمان',
            shareChartSvg({
              series: warranty,
              color: brand.primary,
              width: CHART_HALF,
              format: countText,
            }),
          ),
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
    ].join('\n'),
  });
}
