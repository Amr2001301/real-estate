import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignChannel, CampaignStatus, LeadStage, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { AddCampaignSpendDto, CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { adPlatform, normalizeCampaignCode, type AdPlatform } from './campaign-attribution';

/** Stages a lead reaches once it is genuinely interested. */
const QUALIFIED: LeadStage[] = [LeadStage.INTERESTED, LeadStage.VISIT, LeadStage.NEGOTIATION, LeadStage.WON];

const day = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : v === null ? null : undefined);
const money = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CampaignStats {
  leads: number;
  qualified: number;
  won: number;
  lost: number;
  spend: number;
  /** Cost per lead; null without leads. */
  cpl: number | null;
  /** Cost per sale; null without sales. */
  cpa: number | null;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The company's website, for the campaign's tracking links: its primary
   * live domain, else its platform address, else the platform's site.
   */
  private async siteUrl(companyId: string): Promise<string> {
    const domains = await this.prisma.companyDomain.findMany({
      where: { companyId, verifiedAt: { not: null } },
      select: { hostname: true, isPrimary: true, type: true },
    });
    const pick = domains.find((d) => d.isPrimary) ?? domains.find((d) => d.type === 'PLATFORM_SUBDOMAIN') ?? domains[0];
    if (pick) return `https://${pick.hostname}`;
    return (this.config.get<string>('PUBLIC_WEB_URL') ?? '').replace(/\/$/, '');
  }

  /** Lead counts by stage and total spend for each campaign (all of the company's when `ids` is omitted). */
  private async stats(companyId: string, ids?: string[]): Promise<Map<string, CampaignStats>> {
    const inIds = ids ? { in: ids } : { not: null };
    const [byStage, spend] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['campaignId', 'stage'],
        where: { companyId, campaignId: inIds },
        _count: true,
      }),
      this.prisma.campaignSpend.groupBy({
        by: ['campaignId'],
        where: { companyId, ...(ids ? { campaignId: { in: ids } } : {}) },
        _sum: { amount: true },
      }),
    ]);
    const out = new Map<string, CampaignStats>();
    const row = (id: string) => {
      let r = out.get(id);
      if (!r) out.set(id, (r = { leads: 0, qualified: 0, won: 0, lost: 0, spend: 0, cpl: null, cpa: null }));
      return r;
    };
    for (const g of byStage) {
      if (!g.campaignId) continue;
      const r = row(g.campaignId);
      r.leads += g._count;
      if (QUALIFIED.includes(g.stage)) r.qualified += g._count;
      if (g.stage === LeadStage.WON) r.won += g._count;
      if (g.stage === LeadStage.LOST) r.lost += g._count;
    }
    for (const g of spend) row(g.campaignId).spend = round2(money(g._sum.amount));
    for (const r of out.values()) {
      r.cpl = r.leads > 0 ? round2(r.spend / r.leads) : null;
      r.cpa = r.won > 0 ? round2(r.spend / r.won) : null;
    }
    return out;
  }

  private static empty(): CampaignStats {
    return { leads: 0, qualified: 0, won: 0, lost: 0, spend: 0, cpl: null, cpa: null };
  }

  async list(opts: { status?: CampaignStatus; channel?: CampaignChannel; projectId?: string } = {}) {
    const companyId = getRequiredCompanyId();
    const rows = await this.prisma.campaign.findMany({
      where: {
        companyId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.channel ? { channel: opts.channel } : {}),
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        project: { select: { id: true, name: true } },
        source: { select: { id: true, name: true } },
      },
    });
    const stats = await this.stats(companyId, rows.map((r) => r.id));
    const data = rows.map((r) => ({ ...r, budget: r.budget == null ? null : Number(r.budget), stats: stats.get(r.id) ?? CampaignsService.empty() }));
    // The whole list's totals, for the page's band.
    const totals = data.reduce(
      (t, r) => ({ leads: t.leads + r.stats.leads, won: t.won + r.stats.won, spend: round2(t.spend + r.stats.spend) }),
      { leads: 0, won: 0, spend: 0 },
    );
    return {
      data,
      totals: { ...totals, cpl: totals.leads > 0 ? round2(totals.spend / totals.leads) : null, cpa: totals.won > 0 ? round2(totals.spend / totals.won) : null },
    };
  }

  /** For pickers: every campaign, live ones first. */
  async options() {
    const rows = await this.prisma.campaign.findMany({
      where: { companyId: getRequiredCompanyId() },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, name: true, code: true, channel: true, status: true, projectId: true },
    });
    const live = (s: CampaignStatus) => (s === CampaignStatus.ACTIVE ? 0 : s === CampaignStatus.PLANNED ? 1 : s === CampaignStatus.PAUSED ? 2 : 3);
    return rows.sort((a, b) => live(a.status) - live(b.status));
  }

  async get(id: string) {
    const companyId = getRequiredCompanyId();
    const c = await this.prisma.campaign.findFirst({
      where: { id, companyId },
      include: {
        project: { select: { id: true, name: true } },
        source: { select: { id: true, name: true } },
        spend: { orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    const [statsMap, platforms] = await Promise.all([this.stats(companyId, [id]), this.platforms(companyId, id)]);
    const stats = statsMap.get(id) ?? CampaignsService.empty();
    return {
      ...c,
      budget: c.budget == null ? null : Number(c.budget),
      spend: c.spend.map((s) => ({ ...s, amount: Number(s.amount) })),
      stats,
      platforms,
      siteUrl: await this.siteUrl(companyId),
    };
  }

  /**
   * The campaign's leads by the platform their ad ran on (one Meta campaign
   * shows on Facebook, Instagram and Messenger alike); `null` = not known.
   */
  private async platforms(companyId: string, campaignId: string) {
    const groups = await this.prisma.lead.groupBy({
      by: ['utmSource', 'stage'],
      where: { companyId, campaignId },
      _count: true,
    });
    const out = new Map<AdPlatform | null, { platform: AdPlatform | null; leads: number; won: number }>();
    for (const g of groups) {
      const platform = adPlatform(g.utmSource);
      const row = out.get(platform) ?? { platform, leads: 0, won: 0 };
      row.leads += g._count;
      if (g.stage === LeadStage.WON) row.won += g._count;
      out.set(platform, row);
    }
    // Known platforms first, by leads; «not known» last.
    return [...out.values()].sort((a, b) => Number(a.platform === null) - Number(b.platform === null) || b.leads - a.leads);
  }

  async create(dto: CreateCampaignDto) {
    const companyId = getRequiredCompanyId();
    await this.assertRefs(companyId, dto.projectId, dto.sourceId);
    this.assertDates(dto.startDate, dto.endDate);
    const code = normalizeCampaignCode(dto.code) ?? (await this.freeCode(companyId, dto.name));
    await this.assertCodeFree(companyId, code);
    return this.prisma.campaign.create({
      data: {
        name: dto.name.trim(),
        code,
        channel: dto.channel,
        status: dto.status ?? CampaignStatus.ACTIVE,
        projectId: dto.projectId ?? null,
        sourceId: dto.sourceId ?? null,
        startDate: day(dto.startDate) ?? null,
        endDate: day(dto.endDate) ?? null,
        budget: dto.budget ?? null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const companyId = getRequiredCompanyId();
    const current = await this.prisma.campaign.findFirst({ where: { id, companyId } });
    if (!current) throw new NotFoundException('Campaign not found');
    await this.assertRefs(companyId, dto.projectId ?? undefined, dto.sourceId ?? undefined);
    const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);
    this.assertDates(
      dto.startDate === undefined ? iso(current.startDate) : (dto.startDate ?? undefined),
      dto.endDate === undefined ? iso(current.endDate) : (dto.endDate ?? undefined),
    );
    // The code stays: links already out in ads carry it.
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.sourceId !== undefined ? { sourceId: dto.sourceId } : {}),
        ...(dto.startDate !== undefined ? { startDate: day(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: day(dto.endDate) } : {}),
        ...(dto.budget !== undefined ? { budget: dto.budget } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
  }

  async addSpend(id: string, dto: AddCampaignSpendDto, userId: string) {
    const companyId = getRequiredCompanyId();
    const c = await this.prisma.campaign.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!c) throw new NotFoundException('Campaign not found');
    const row = await this.prisma.campaignSpend.create({
      data: { campaignId: id, amount: dto.amount, spentOn: day(dto.spentOn)!, note: dto.note?.trim() || null, createdById: userId },
    });
    return { ...row, amount: Number(row.amount) };
  }

  async removeSpend(id: string, spendId: string) {
    const companyId = getRequiredCompanyId();
    const row = await this.prisma.campaignSpend.findFirst({ where: { id: spendId, campaignId: id, companyId }, select: { id: true } });
    if (!row) throw new NotFoundException('Spend entry not found');
    await this.prisma.campaignSpend.delete({ where: { id: spendId } });
    return { ok: true };
  }

  private assertDates(start?: string | null, end?: string | null) {
    if (start && end && end < start) throw new BadRequestException('تاريخ النهاية قبل تاريخ البداية');
  }

  /** The project and source must be the company's own. */
  private async assertRefs(companyId: string, projectId?: string, sourceId?: string) {
    if (projectId && !(await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Project not found');
    }
    if (sourceId && !(await this.prisma.leadSource.findFirst({ where: { id: sourceId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Lead source not found');
    }
  }

  private async assertCodeFree(companyId: string, code: string, exceptId?: string) {
    const taken = await this.prisma.campaign.findFirst({ where: { companyId, code, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (taken) throw new ConflictException('يوجد حملة بنفس الكود');
  }

  /**
   * A code made from the name: Latin letters and digits kept, the rest as
   * dashes; an Arabic-only name gets `campaign-<n>`. Unique in the company.
   */
  private async freeCode(companyId: string, name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'campaign';
    const taken = new Set(
      (
        await this.prisma.campaign.findMany({ where: { companyId, code: { startsWith: base } }, select: { code: true } })
      ).map((c) => c.code),
    );
    if (base !== 'campaign' && !taken.has(base)) return base;
    for (let n = 1; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}
