import { Injectable, Optional } from '@nestjs/common';
import { CampaignChannel, CampaignStatus, LeadStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { currentCompanyTimeZone, localDayStartInstant } from '../../common/time/company-timezone';
import { NET_PRICE_SQL } from '../../common/finance/commission-basis';
import { getCompanyCurrency } from '../../common/currency/currency';
import { fallbackBrand, type ReportBrand } from '../../common/utils/report-brand';
import { ReportBrandService } from '../company-branding/report-brand.service';
import { presentReportPdf, ReportPdfService } from '../../common/report-pdf/report-pdf.service';
import {
  addBoardBanner,
  addChartBlock,
  addFooter,
  addKpiCards,
  addSectionTitle,
  addTable,
  createReportWorkbook,
  formatMoneyColumns,
  setupBoardSheet,
  workbookToBuffer,
} from '../../common/utils/xlsx';
import { renderBarChartPng } from '../../common/utils/xlsx-chart';
import { CHANNEL_AR, campaignReportHtml, periodText, ratioText } from './campaign-report-templates';

/** Stages a lead reaches once it is genuinely interested. */
const QUALIFIED: LeadStage[] = [LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION, LeadStage.WON];

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export interface CampaignReportOptions {
  /** Company days (`YYYY-MM-DD`), both included. */
  from?: string;
  to?: string;
  channel?: CampaignChannel;
  projectId?: string;
}

/** The figures every row of the report carries. */
export interface CampaignFigures {
  spend: number;
  leads: number;
  qualified: number;
  won: number;
  lost: number;
  /** Signed, live contracts credited to the campaign. */
  sales: number;
  /** Their net price (without the instalment markup — the sales report's figure). */
  revenue: number;
  /** Cost per lead; null without leads. */
  cpl: number | null;
  /** Cost per sale (per contract); null without sales. */
  cpa: number | null;
  /** (revenue − spend) / spend, in %; null without spend. */
  roi: number | null;
  /** Sales per lead, in %; null without leads. */
  conversion: number | null;
}

const blank = (): CampaignFigures => ({
  spend: 0,
  leads: 0,
  qualified: 0,
  won: 0,
  lost: 0,
  sales: 0,
  revenue: 0,
  cpl: null,
  cpa: null,
  roi: null,
  conversion: null,
});

function finish<T extends CampaignFigures>(f: T): T {
  f.spend = round2(f.spend);
  f.revenue = round2(f.revenue);
  f.cpl = f.leads > 0 ? round2(f.spend / f.leads) : null;
  f.cpa = f.sales > 0 ? round2(f.spend / f.sales) : null;
  f.roi = f.spend > 0 ? Math.round(((f.revenue - f.spend) / f.spend) * 1000) / 10 : null;
  f.conversion = pct(f.sales, f.leads);
  return f;
}

function add(into: CampaignFigures, f: CampaignFigures) {
  into.spend += f.spend;
  into.leads += f.leads;
  into.qualified += f.qualified;
  into.won += f.won;
  into.lost += f.lost;
  into.sales += f.sales;
  into.revenue += f.revenue;
}

export type CampaignReport = Awaited<ReturnType<CampaignReportService['report']>>;

/**
 * Phase 3 of the campaigns plan: what each campaign cost and brought in, and
 * the same by channel, by project and by month, with PDF and Excel copies.
 *
 * - Spend: the entries dated in the period.
 * - Leads: the campaign's leads that arrived in the period (their stage now).
 * - Sales: signed, live contracts signed in the period, credited to the
 *   campaign of the buyer's first lead that came from a campaign (first
 *   touch, decided with the campaigns plan) — that lead must predate the
 *   signing. Revenue is their net price, as in the sales report.
 */
@Injectable()
export class CampaignReportService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly reportBrand?: ReportBrandService,
    @Optional() private readonly reportPdf?: ReportPdfService,
  ) {}

  async report(opts: CampaignReportOptions = {}) {
    const companyId = getRequiredCompanyId();
    const zone = await currentCompanyTimeZone(this.prisma, companyId);
    const from = opts.from ? localDayStartInstant(zone, opts.from) : undefined;
    const to = opts.to ? new Date(localDayStartInstant(zone, opts.to).getTime() + 24 * 60 * 60 * 1000) : undefined;
    const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
    // Spend entries are calendar dates (UTC midnight).
    const spendRange =
      opts.from || opts.to
        ? {
            ...(opts.from ? { gte: new Date(`${opts.from}T00:00:00.000Z`) } : {}),
            ...(opts.to ? { lte: new Date(`${opts.to}T00:00:00.000Z`) } : {}),
          }
        : undefined;

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        companyId,
        ...(opts.channel ? { channel: opts.channel } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        code: true,
        channel: true,
        status: true,
        budget: true,
        startDate: true,
        endDate: true,
        project: { select: { id: true, name: true } },
      },
    });
    const ids = campaigns.map((c) => c.id);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`c."companyId" = ${companyId}::uuid`,
      Prisma.sql`c."status" <> 'CANCELLED'`,
      Prisma.sql`c."deletedAt" IS NULL`,
      Prisma.sql`c."signedAt" IS NOT NULL`,
    ];
    if (from) conditions.push(Prisma.sql`c."signedAt" >= ${from}`);
    if (to) conditions.push(Prisma.sql`c."signedAt" < ${to}`);

    const [leads, spend, contracts, otherLeads] = await Promise.all([
      ids.length
        ? this.prisma.lead.findMany({
            where: { companyId, campaignId: { in: ids }, ...(range ? { createdAt: range } : {}) },
            select: { campaignId: true, stage: true, createdAt: true },
          })
        : [],
      ids.length
        ? this.prisma.campaignSpend.findMany({
            where: { companyId, campaignId: { in: ids }, ...(spendRange ? { spentOn: spendRange } : {}) },
            select: { campaignId: true, amount: true, spentOn: true },
          })
        : [],
      ids.length
        ? this.prisma.$queryRaw<Array<{ campaignId: string; signedAt: Date; net: number }>>(Prisma.sql`
            SELECT first_touch."campaignId", c."signedAt", (${NET_PRICE_SQL})::float AS net
            FROM "Contract" c
            LEFT JOIN "Reservation" r ON r.id = c."reservationId"
            CROSS JOIN LATERAL (
              SELECT l."campaignId"
              FROM "Lead" l
              WHERE l."companyId" = c."companyId"
                AND l."campaignId" IS NOT NULL
                AND (l."clientId" = c."customerId" OR l.id = r."leadId")
                AND l."createdAt" <= c."signedAt"
              ORDER BY l."createdAt" ASC
              LIMIT 1
            ) first_touch
            WHERE ${Prisma.join(conditions, ' AND ')}
              AND first_touch."campaignId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
          `)
        : [],
      // Leads that came in some other way, for the campaigns' share.
      this.prisma.lead.count({
        where: {
          companyId,
          campaignId: null,
          ...(opts.projectId ? { projectInterestId: opts.projectId } : {}),
          ...(range ? { createdAt: range } : {}),
        },
      }),
    ]);

    const byId = new Map(ids.map((id) => [id, blank()]));
    const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit' });
    const trend = new Map<string, { spend: number; leads: number; sales: number; revenue: number }>();
    const month = (key: string) => {
      let m = trend.get(key);
      if (!m) trend.set(key, (m = { spend: 0, leads: 0, sales: 0, revenue: 0 }));
      return m;
    };

    for (const l of leads) {
      const f = byId.get(l.campaignId!);
      if (!f) continue;
      f.leads += 1;
      if (QUALIFIED.includes(l.stage)) f.qualified += 1;
      if (l.stage === LeadStage.WON) f.won += 1;
      if (l.stage === LeadStage.LOST) f.lost += 1;
      month(monthKey.format(l.createdAt).slice(0, 7)).leads += 1;
    }
    for (const s of spend) {
      const f = byId.get(s.campaignId);
      if (!f) continue;
      const amount = Number(s.amount);
      f.spend += amount;
      month(s.spentOn.toISOString().slice(0, 7)).spend += amount;
    }
    for (const c of contracts) {
      const f = byId.get(c.campaignId);
      if (!f) continue;
      f.sales += 1;
      f.revenue += c.net;
      const m = month(monthKey.format(new Date(c.signedAt)).slice(0, 7));
      m.sales += 1;
      m.revenue += c.net;
    }

    // Every campaign that did something in the period, and the running ones.
    const rows = campaigns
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        channel: c.channel,
        status: c.status,
        budget: c.budget == null ? null : Number(c.budget),
        startDate: c.startDate,
        endDate: c.endDate,
        project: c.project,
        ...finish(byId.get(c.id)!),
      }))
      .filter((r) => r.status === CampaignStatus.ACTIVE || r.spend > 0 || r.leads > 0 || r.sales > 0)
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || b.spend - a.spend);

    const totals = blank();
    const channels = new Map<CampaignChannel, CampaignFigures & { campaigns: number }>();
    const projects = new Map<string | null, CampaignFigures & { campaigns: number; name: unknown }>();
    for (const r of rows) {
      add(totals, r);
      const ch = channels.get(r.channel) ?? { ...blank(), campaigns: 0 };
      add(ch, r);
      ch.campaigns += 1;
      channels.set(r.channel, ch);
      const key = r.project?.id ?? null;
      const pr = projects.get(key) ?? { ...blank(), campaigns: 0, name: r.project?.name ?? null };
      add(pr, r);
      pr.campaigns += 1;
      projects.set(key, pr);
    }
    finish(totals);
    const ranked = <T extends CampaignFigures>(list: T[]) => list.sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || b.spend - a.spend);

    return {
      period: { from: opts.from ?? null, to: opts.to ?? null },
      totals: {
        ...totals,
        campaigns: rows.length,
        otherLeads,
        /** Of all leads in the period, the share from campaigns (%). */
        leadShare: pct(totals.leads, totals.leads + otherLeads),
      },
      campaigns: rows,
      byChannel: ranked([...channels.entries()].map(([channel, f]) => ({ channel, ...finish(f) }))),
      byProject: ranked([...projects.entries()].map(([projectId, f]) => ({ projectId, ...finish(f) }))),
      trend: [...trend.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, v]) => ({ month: m, spend: round2(v.spend), leads: v.leads, sales: v.sales, revenue: round2(v.revenue) })),
    };
  }

  private async brand(): Promise<ReportBrand> {
    const companyId = getRequiredCompanyId();
    return (await this.reportBrand?.forCompany(companyId)) ?? fallbackBrand(await getCompanyCurrency(this.prisma, companyId));
  }

  async pdf(opts: CampaignReportOptions = {}): Promise<Buffer> {
    const [r, brand] = await Promise.all([this.report(opts), this.brand()]);
    return presentReportPdf(this.reportPdf, campaignReportHtml(r, brand, opts), brand);
  }

  async xlsx(opts: CampaignReportOptions = {}): Promise<Buffer> {
    const [r, brand] = await Promise.all([this.report(opts), this.brand()]);
    const currency = brand.currency;
    const t = r.totals;
    const SPAN = 6;
    const wb = createReportWorkbook();

    const cover = wb.addWorksheet('الملخص');
    setupBoardSheet(cover, { widths: [16, 16, 16, 16, 16, 16], landscape: true });
    addBoardBanner(cover, 'تقرير الحملات التسويقية', SPAN, { wb, brand });
    addSectionTitle(cover, 'الملخص التنفيذي', SPAN);
    addKpiCards(
      cover,
      [
        { label: 'الفترة', value: periodText(opts) },
        { label: 'المصروف', value: t.spend, currency },
        { label: 'العملاء المحتملون', value: t.leads },
        { label: 'تكلفة العميل', value: t.cpl ?? '—', ...(t.cpl != null ? { currency } : {}) },
        { label: 'المبيعات (عقود)', value: t.sales },
        { label: 'تكلفة البيعة', value: t.cpa ?? '—', ...(t.cpa != null ? { currency } : {}) },
        { label: 'إيراد المبيعات', value: t.revenue, currency },
        { label: 'العائد على الصرف', value: ratioText(t.roi) },
        { label: 'نسبة التحويل', value: ratioText(t.conversion) },
      ],
      { span: SPAN, perRow: 3 },
    );
    const channelChart = await renderBarChartPng({
      width: 720,
      height: 320,
      series: r.byChannel.slice(0, 8).map((c) => ({ label: CHANNEL_AR[c.channel] ?? c.channel, value: c.revenue || c.leads })),
    });
    addChartBlock(wb, cover, 'الإيراد حسب القناة', channelChart, { span: SPAN, width: 720, height: 320 });
    addFooter(cover, brand);

    const figures = (f: CampaignFigures) => [
      f.spend,
      f.leads,
      f.qualified,
      f.sales,
      f.revenue,
      f.cpl ?? '—',
      f.cpa ?? '—',
      f.roi == null ? '—' : `${f.roi}%`,
      f.conversion == null ? '—' : `${f.conversion}%`,
    ];
    const FIG = ['المصروف', 'العملاء', 'المهتمون', 'المبيعات', 'الإيراد', 'تكلفة العميل', 'تكلفة البيعة', 'العائد', 'التحويل'];
    const FIG_W = [16, 11, 11, 11, 18, 14, 14, 11, 11];

    const byCampaign = wb.addWorksheet('حسب الحملة');
    addTable(
      byCampaign,
      ['الحملة', 'القناة', 'المشروع', ...FIG],
      r.campaigns.map((c) => [c.name, CHANNEL_AR[c.channel] ?? c.channel, arName(c.project?.name), ...figures(c)]),
      [28, 14, 22, ...FIG_W],
    );
    formatMoneyColumns(byCampaign, [4, 8, 9, 10], currency);

    const byChannel = wb.addWorksheet('حسب القناة');
    addTable(
      byChannel,
      ['القناة', 'الحملات', ...FIG],
      r.byChannel.map((c) => [CHANNEL_AR[c.channel] ?? c.channel, c.campaigns, ...figures(c)]),
      [18, 10, ...FIG_W],
    );
    formatMoneyColumns(byChannel, [3, 7, 8, 9], currency);

    const byProject = wb.addWorksheet('حسب المشروع');
    addTable(
      byProject,
      ['المشروع', 'الحملات', ...FIG],
      r.byProject.map((p) => [arName(p.name) || 'بدون مشروع', p.campaigns, ...figures(p)]),
      [26, 10, ...FIG_W],
    );
    formatMoneyColumns(byProject, [3, 7, 8, 9], currency);

    const byMonth = wb.addWorksheet('حسب الشهر');
    addTable(
      byMonth,
      ['الشهر', 'المصروف', 'العملاء', 'المبيعات', 'الإيراد'],
      r.trend.map((m) => [m.month, m.spend, m.leads, m.sales, m.revenue]),
      [14, 16, 12, 12, 18],
    );
    formatMoneyColumns(byMonth, [2, 5], currency);

    return workbookToBuffer(wb);
  }
}

/** A project's Arabic name (`{ar, en}` as stored). */
export function arName(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const t = v as { ar?: string; en?: string };
  return t.ar || t.en || '';
}
