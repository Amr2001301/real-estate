import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getRequiredCompanyId } from '../../common/tenant/tenant-context';
import { phoneForWrite } from '../../common/utils/phone-for-write';
import { NotificationsService } from '../notifications/notifications.module';
import { LeadsService } from '../leads/leads.service';
import { firstCall, nextRoundRobinSales, routingSettings, saveRoutingSettings } from '../leads/lead-routing';
import { campaignForUtm } from '../campaigns/campaign-attribution';
import { CreateIntakeKeyDto, IntakeLeadDto, RoutingSettingsDto, UpdateIntakeKeyDto } from './lead-intake.dto';

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
const newKey = () => `lk_${randomBytes(24).toString('base64url')}`;

@Injectable()
export class LeadIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The company a public intake post is for: active, by its slug. */
  async companyBySlug(slug: string): Promise<string> {
    const company = await this.prisma.company.findFirst({
      where: { slug: slug.trim().toLowerCase(), isActive: true },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company.id;
  }

  /**
   * A lead posted by a source holding one of the company's keys. A person
   * who already has an open lead is kept on it (noted as returned); anyone
   * else becomes a new lead — handed to the next rep in turn, with a first
   * call scheduled, under the post's or the key's campaign and project.
   */
  async intake(rawKey: string | undefined, dto: IntakeLeadDto) {
    const companyId = getRequiredCompanyId();
    if (!rawKey) throw new UnauthorizedException('Missing intake key');
    const key = await this.prisma.leadIntakeKey.findFirst({ where: { companyId, tokenHash: hash(rawKey), active: true } });
    if (!key) throw new UnauthorizedException('Invalid intake key');

    const phone = await phoneForWrite(this.prisma, dto.phone, companyId);
    if (!phone) throw new BadRequestException('Invalid phone number');
    const campaign = (await campaignForUtm(this.prisma, companyId, dto.campaign)) ?? (key.campaignId ? { id: key.campaignId } : null);
    if (dto.projectId && !(await this.prisma.project.findFirst({ where: { id: dto.projectId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Project not found');
    }
    await this.prisma.leadIntakeKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date(), useCount: { increment: 1 } } });

    const existing = await this.prisma.lead.findFirst({
      where: { companyId, phone, stage: { notIn: [LeadStage.WON, LeadStage.LOST] } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await this.prisma.leadActivity.create({
        data: { leadId: existing.id, type: 'returned', payload: { via: key.name, campaignId: campaign?.id ?? null, message: dto.message ?? null } },
      });
      // First touch stays: a returning lead only gains a campaign it had none of.
      if (!existing.campaignId && campaign) {
        await this.prisma.lead.updateMany({ where: { id: existing.id, companyId }, data: { campaignId: campaign.id } });
      }
      await this.notifications.sendToUser(existing.assignedSalesId, 'lead_updated', {
        entityType: 'lead',
        entityId: existing.id,
        customerName: existing.fullName,
      });
      return { status: 'existing' as const, leadId: existing.id };
    }

    const routing = await routingSettings(this.prisma);
    const assignee = routing.autoAssign === 'ROUND_ROBIN' ? await nextRoundRobinSales(this.prisma) : null;
    const lead = await this.leads.create({
      fullName: dto.name.trim(),
      phone,
      email: dto.email,
      projectInterestId: dto.projectId ?? key.projectId ?? undefined,
      campaignId: campaign?.id,
      assignedSalesId: assignee ?? undefined,
      notes: dto.message?.trim() ? `رسالة العميل (${key.name}): ${dto.message.trim()}` : undefined,
    });
    const call = firstCall(routing.firstCallMinutes, 'عميل جديد — أول اتصال');
    const utm = {
      ...(dto.utmSource ? { utmSource: dto.utmSource } : {}),
      ...(dto.utmMedium ? { utmMedium: dto.utmMedium } : {}),
      ...(dto.utmContent ? { utmContent: dto.utmContent } : {}),
      ...(dto.campaign ? { utmCampaign: dto.campaign } : {}),
    };
    if (call || Object.keys(utm).length) {
      await this.prisma.lead.updateMany({ where: { id: lead.id, companyId }, data: { ...(call ?? {}), ...utm } });
    }
    return { status: 'created' as const, leadId: lead.id, assignedSalesId: lead.assignedSalesId };
  }

  // ----- Keys (admin) -----
  listKeys() {
    return this.prisma.leadIntakeKey.findMany({
      where: { companyId: getRequiredCompanyId() },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        active: true,
        lastUsedAt: true,
        useCount: true,
        createdAt: true,
        campaign: { select: { id: true, name: true, channel: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  /** A new key; the key itself is returned this once and only its hash kept. */
  async createKey(dto: CreateIntakeKeyDto) {
    const companyId = getRequiredCompanyId();
    await this.assertRefs(companyId, dto.campaignId, dto.projectId);
    const key = newKey();
    const row = await this.prisma.leadIntakeKey.create({
      data: { name: dto.name.trim(), tokenHash: hash(key), tokenPrefix: key.slice(0, 9), campaignId: dto.campaignId ?? null, projectId: dto.projectId ?? null },
      select: { id: true, name: true, tokenPrefix: true },
    });
    return { ...row, key };
  }

  async updateKey(id: string, dto: UpdateIntakeKeyDto) {
    const companyId = getRequiredCompanyId();
    await this.assertKey(companyId, id);
    await this.assertRefs(companyId, dto.campaignId ?? undefined, dto.projectId ?? undefined);
    return this.prisma.leadIntakeKey.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.campaignId !== undefined ? { campaignId: dto.campaignId } : {}),
        ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      select: { id: true, name: true, active: true },
    });
  }

  /** A fresh key for the same source; the old one stops working at once. */
  async rotateKey(id: string) {
    const companyId = getRequiredCompanyId();
    await this.assertKey(companyId, id);
    const key = newKey();
    await this.prisma.leadIntakeKey.update({ where: { id }, data: { tokenHash: hash(key), tokenPrefix: key.slice(0, 9) } });
    return { id, key, tokenPrefix: key.slice(0, 9) };
  }

  async deleteKey(id: string) {
    const companyId = getRequiredCompanyId();
    await this.assertKey(companyId, id);
    await this.prisma.leadIntakeKey.delete({ where: { id } });
    return { ok: true };
  }

  /** The routing settings, with the company's slug for its intake address. */
  async getRouting() {
    const company = await this.prisma.company.findUnique({ where: { id: getRequiredCompanyId() }, select: { slug: true } });
    return { ...(await routingSettings(this.prisma)), companySlug: company?.slug ?? null };
  }

  saveRouting(dto: RoutingSettingsDto) {
    return saveRoutingSettings(this.prisma, dto);
  }

  private async assertKey(companyId: string, id: string) {
    if (!(await this.prisma.leadIntakeKey.findFirst({ where: { id, companyId }, select: { id: true } }))) {
      throw new NotFoundException('Intake key not found');
    }
  }

  private async assertRefs(companyId: string, campaignId?: string, projectId?: string) {
    if (campaignId && !(await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Campaign not found');
    }
    if (projectId && !(await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } }))) {
      throw new BadRequestException('Project not found');
    }
  }
}
