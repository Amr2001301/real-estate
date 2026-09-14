import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveTenantUser } from '../../common/tenant/resolve-tenant-entity';
import { NotificationsService } from '../notifications/notifications.module';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ApproveBrokerLeadDto,
  BrokerLeadsQueryDto,
  MarkBrokerLeadDuplicateDto,
  RejectBrokerLeadDto,
} from './dto/broker-lead.dto';

const BROKER_LEAD_INCLUDE = {
  client: {
    select: { id: true, fullName: true, phone: true, email: true, role: true },
  },
  source: true,
  projectInterest: { select: { id: true, name: true, city: true } },
  unitInterest: { select: { id: true, code: true, type: true } },
  assignedSales: { select: { id: true, fullName: true } },
  broker: {
    select: {
      id: true,
      companyName: true,
      commercialName: true,
      code: true,
      status: true,
    },
  },
  brokerAgent: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
} as const;

@Injectable()
export class BrokerLeadsService {
  private readonly logger = new Logger(BrokerLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: BrokerLeadsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmed = query.q?.trim();

    const where: Prisma.LeadWhereInput = {
      // Only broker-submitted leads (those with non-null brokerId).
      NOT: { brokerId: null },
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.brokerApprovalStatus
        ? { brokerApprovalStatus: query.brokerApprovalStatus }
        : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.projectId ? { projectInterestId: query.projectId } : {}),
      ...(query.assignedSalesId
        ? { assignedSalesId: query.assignedSalesId }
        : {}),
      ...(trimmed
        ? {
            OR: [
              { fullName: { contains: trimmed, mode: 'insensitive' } },
              { phone: { contains: trimmed } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: [
          { brokerApprovalStatus: 'asc' }, // PENDING first
          { brokerSubmittedAt: 'desc' },
        ],
        ...takeSkip({ page, pageSize }),
        include: BROKER_LEAD_INCLUDE,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...BROKER_LEAD_INCLUDE,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { sales: { select: { id: true, fullName: true } } },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.brokerId) {
      throw new NotFoundException(
        'This lead was not submitted by a broker; use the regular leads endpoint instead',
      );
    }
    return lead;
  }

  async approve(id: string, dto: ApproveBrokerLeadDto, actor: AuthUser) {
    const lead = await this.assertBrokerLead(id);
    if (lead.brokerApprovalStatus === 'APPROVED') {
      throw new BadRequestException('Lead is already approved');
    }
    if (dto.assignedSalesId) {
      const sales = await resolveTenantUser(
        this.prisma,
        dto.assignedSalesId,
        { id: true, role: true, active: true },
        { expectRoles: [UserRole.SALES, UserRole.ADMIN], label: 'Sales user not found' },
      );
      if (!sales.active) {
        throw new BadRequestException('Sales user is not active');
      }
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          brokerApprovalStatus: 'APPROVED',
          brokerApprovedAt: now,
          brokerRejectedAt: null,
          brokerRejectionReason: null,
          ...(dto.assignedSalesId
            ? { assignedSalesId: dto.assignedSalesId }
            : {}),
        },
        include: BROKER_LEAD_INCLUDE,
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'broker_approved',
          payload: {
            by: actor.sub,
            assignedSalesId: dto.assignedSalesId ?? null,
            note: dto.note ?? null,
          },
        },
      });

      if (dto.assignedSalesId && dto.note) {
        await tx.leadNote.create({
          data: { leadId: id, salesId: dto.assignedSalesId, body: dto.note },
        });
      }

      return updated;
    });

    await this.notifyBroker(id, 'broker_lead_approved', {
      leadId: id,
      assignedSalesId: dto.assignedSalesId ?? null,
      note: dto.note ?? null,
    });
    return result;
  }

  async reject(id: string, dto: RejectBrokerLeadDto, actor: AuthUser) {
    await this.assertBrokerLead(id);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('reason is required');

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          brokerApprovalStatus: 'REJECTED',
          brokerRejectedAt: now,
          brokerRejectionReason: reason,
          brokerApprovedAt: null,
          stage: 'LOST',
        },
        include: BROKER_LEAD_INCLUDE,
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'broker_rejected',
          payload: { by: actor.sub, reason },
        },
      });

      return updated;
    });

    await this.notifyBroker(id, 'broker_lead_rejected', {
      leadId: id,
      reason,
    });
    return result;
  }

  async markDuplicate(
    id: string,
    dto: MarkBrokerLeadDuplicateDto,
    actor: AuthUser,
  ) {
    await this.assertBrokerLead(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          brokerApprovalStatus: 'DUPLICATE',
          brokerApprovedAt: null,
          brokerRejectedAt: null,
          brokerRejectionReason: dto.reason?.trim() || null,
        },
        include: BROKER_LEAD_INCLUDE,
      });

      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'broker_marked_duplicate',
          payload: { by: actor.sub, reason: dto.reason ?? null },
        },
      });

      return updated;
    });

    await this.notifyBroker(id, 'broker_lead_marked_duplicate', {
      leadId: id,
      reason: dto.reason ?? null,
    });
    return result;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async assertBrokerLead(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        brokerId: true,
        brokerApprovalStatus: true,
        stage: true,
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.brokerId) {
      throw new NotFoundException(
        'This lead was not submitted by a broker; use the regular leads endpoint instead',
      );
    }
    return lead;
  }

  /**
   * P4 — route through NotificationsService.sendToUsers. Payload is the
   * SAFE whitelist: leadReference (the lead's plaintext identifier on the
   * broker side) + the projectInterest name. Phone numbers and full lead
   * objects are NOT exposed in the notification body (they were before).
   */
  private async notifyBroker(
    leadId: string,
    templateCode: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const lead = await this.prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          fullName: true,
          brokerId: true,
          projectInterest: { select: { name: true } },
        },
      });
      if (!lead?.brokerId) return;

      const brokerUsers = await this.prisma.brokerUser.findMany({
        where: { brokerId: lead.brokerId, status: 'ACTIVE' },
        select: { userId: true },
      });
      if (brokerUsers.length === 0) return;

      const projectName =
        (lead.projectInterest?.name as { ar?: string; en?: string } | undefined)
          ?.ar ||
        (lead.projectInterest?.name as { ar?: string; en?: string } | undefined)
          ?.en ||
        '';
      const safePayload = {
        ...payload,
        leadReference: lead.fullName ?? '',
        projectName,
      };
      await this.notifications.sendToUsers(
        brokerUsers.map((bu) => bu.userId),
        templateCode,
        safePayload,
      );
    } catch (e) {
      // The helper already swallows per-recipient errors; this catches
      // failures from resolving the lead / broker-user set.
      this.logger.warn(
        `notifyBroker(${templateCode}) for lead ${leadId} failed: ${(e as Error).message}`,
      );
    }
  }
}
