import {
  CHART_FULL,
  CHART_HALF,
  chartPanel,
  countText,
  dataTable,
  kpiGrid,
  moneyText,
  panelGrid,
  reportDocument,
  section,
  type Column,
} from '../../common/report-pdf/report-html';
import { barChartSvg, shareChartSvg } from '../../common/report-pdf/svg-charts';
import type { ReportBrand } from '../../common/utils/report-brand';
import type { CampaignFigures, CampaignReport, CampaignReportOptions } from './campaign-report.service';

export const CHANNEL_AR: Record<string, string> = {
  FACEBOOK: 'ميتا (فيسبوك + إنستجرام)',
  INSTAGRAM: 'انستغرام',
  TIKTOK: 'تيك توك',
  GOOGLE: 'جوجل',
  SNAPCHAT: 'سناب شات',
  WHATSAPP: 'واتساب',
  SMS: 'رسائل SMS',
  EMAIL: 'بريد إلكتروني',
  BILLBOARD: 'لافتات طرق',
  EVENT: 'معرض / فعالية',
  OTHER: 'أخرى',
};

/** "من 2026-01-01 إلى 2026-03-31" or «كل الفترات». */
export function periodText(o: Pick<CampaignReportOptions, 'from' | 'to'>): string {
  if (o.from && o.to) return `من ${o.from} إلى ${o.to}`;
  if (o.from) return `من ${o.from}`;
  if (o.to) return `حتى ${o.to}`;
  return 'كل الفترات';
}

/** A percentage figure (ROI, conversion) or «—». */
export function ratioText(v: number | null): string {
  return v == null ? '—' : `${v.toLocaleString('en-US')}%`;
}

function nameAr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const t = v as { ar?: string; en?: string };
  return t.ar || t.en || '';
}

const FIGURE_COLUMNS: Column[] = [
  { label: 'المصروف', numeric: true, width: 1.2 },
  { label: 'العملاء', numeric: true, width: 0.7 },
  { label: 'المبيعات', numeric: true, width: 0.7 },
  { label: 'الإيراد', numeric: true, width: 1.3 },
  { label: 'تكلفة العميل', numeric: true, width: 1 },
  { label: 'تكلفة البيعة', numeric: true, width: 1.1 },
  { label: 'العائد', numeric: true, width: 0.8 },
];

function figureCells(f: CampaignFigures, c: string): string[] {
  return [
    moneyText(f.spend, c),
    countText(f.leads),
    countText(f.sales),
    moneyText(f.revenue, c),
    f.cpl == null ? '—' : moneyText(f.cpl, c),
    f.cpa == null ? '—' : moneyText(f.cpa, c),
    ratioText(f.roi),
  ];
}

/** The campaigns report as a presentation PDF (same data as the JSON and Excel). */
export function campaignReportHtml(r: CampaignReport, brand: ReportBrand, opts: CampaignReportOptions): string {
  const c = brand.currency;
  const t = r.totals;
  const filters: Array<[string, string]> = [];
  if (opts.channel) filters.push(['القناة', CHANNEL_AR[opts.channel] ?? opts.channel]);
  if (opts.projectId) {
    const p = r.byProject.find((x) => x.projectId === opts.projectId);
    filters.push(['المشروع', nameAr(p?.name) || '—']);
  }
  return reportDocument({
    brand,
    title: 'تقرير الحملات التسويقية',
    subtitle: `الفترة: ${periodText(opts)}`,
    meta: filters,
    body: [
      section(
        'الملخص',
        kpiGrid([
          { label: 'المصروف', value: moneyText(t.spend, c), hint: `${countText(t.campaigns)} حملة` },
          {
            label: 'العملاء المحتملون',
            value: countText(t.leads),
            hint: t.leadShare == null ? undefined : `${t.leadShare}% من كل العملاء`,
          },
          { label: 'المبيعات', value: countText(t.sales), hint: `تحويل ${ratioText(t.conversion)}` },
          { label: 'إيراد المبيعات', value: moneyText(t.revenue, c) },
          { label: 'تكلفة العميل', value: t.cpl == null ? '—' : moneyText(t.cpl, c) },
          { label: 'تكلفة البيعة', value: t.cpa == null ? '—' : moneyText(t.cpa, c) },
          {
            label: 'العائد على الصرف',
            value: ratioText(t.roi),
            tone: t.roi == null ? 'default' : t.roi >= 0 ? 'good' : 'warn',
          },
          { label: 'عملاء من مصادر أخرى', value: countText(t.otherLeads) },
        ]),
      ),
      section(
        'المقارنة',
        panelGrid(
          chartPanel(
            'الإيراد حسب القناة',
            shareChartSvg({
              series: r.byChannel.map((x) => ({ label: CHANNEL_AR[x.channel] ?? x.channel, value: x.revenue })),
              color: brand.primary,
              width: CHART_HALF,
            }),
            'لا توجد مبيعات في هذه الفترة',
          ),
          chartPanel(
            'العملاء حسب القناة',
            shareChartSvg({
              series: r.byChannel.map((x) => ({ label: CHANNEL_AR[x.channel] ?? x.channel, value: x.leads })),
              color: brand.accent,
              width: CHART_HALF,
            }),
          ),
        ),
      ),
      section(
        'المصروف شهريًا',
        chartPanel(
          'المصروف',
          barChartSvg({
            series: r.trend.map((m) => ({ label: m.month, value: m.spend })),
            color: brand.primary,
            width: CHART_FULL,
          }),
        ),
      ),
      section(
        'الحملات',
        dataTable(
          [{ label: 'الحملة', width: 2 }, { label: 'القناة', width: 1 }, ...FIGURE_COLUMNS],
          r.campaigns.map((x) => [x.name, CHANNEL_AR[x.channel] ?? x.channel, ...figureCells(x, c)]),
          { totals: ['الإجمالي', '', ...figureCells(t, c)], empty: 'لا توجد حملات في هذه الفترة' },
        ),
      ),
      section(
        'حسب القناة',
        dataTable(
          [{ label: 'القناة', width: 1.4 }, { label: 'الحملات', numeric: true, width: 0.7 }, ...FIGURE_COLUMNS],
          r.byChannel.map((x) => [CHANNEL_AR[x.channel] ?? x.channel, countText(x.campaigns), ...figureCells(x, c)]),
        ),
      ),
      section(
        'حسب المشروع',
        dataTable(
          [{ label: 'المشروع', width: 1.8 }, { label: 'الحملات', numeric: true, width: 0.7 }, ...FIGURE_COLUMNS],
          r.byProject.map((x) => [nameAr(x.name) || 'بدون مشروع', countText(x.campaigns), ...figureCells(x, c)]),
        ),
        'مشروع الحملة',
      ),
    ].join('\n'),
  });
}
