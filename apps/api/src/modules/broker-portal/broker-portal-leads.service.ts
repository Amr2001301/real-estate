import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { CreatePortalLeadDto, PortalLeadsQueryDto } from './dto/portal-lead.dto';

const LEAD_INCLUDE = {
  client: {
    select: { id: true, fullName: true, phone: true, email: true, role: true },
  },
  source: true,
  projectInterest: { select: { id: true, name: true, city: true } },
  unitInterest: { select: { id: true, code: true, type: true } },
  assignedSales: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class BrokerPortalLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Read ────────────────────────────────────────────────────────────────

  async list(scope: BrokerScopeContext, query: PortalLeadsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const trimmed = query.q?.trim();

    const where: Prisma.LeadWhereInput = {
      brokerId: scope.brokerId,
      ...(query.brokerApprovalStatus
        ? { brokerApprovalStatus: query.brokerApprovalStatus }
        : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.projectId ? { projectInterestId: query.projectId } : {}),
      ...(query.unitId ? { unitInterestId: query.unitId } : {}),
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
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: LEAD_INCLUDE,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, brokerId: scope.brokerId },
      include: {
        ...LEAD_INCLUDE,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { sales: { select: { id: true, fullName: true } } },
        },
        appointments: {
          orderBy: { scheduledAt: 'desc' },
          take: 20,
          select: {
            id: true,
            visitNumber: true,
            scheduledAt: true,
            status: true,
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async create(scope: BrokerScopeContext, dto: CreatePortalLeadDto) {
    // 1) Validate scope on project / unit before doing anything else.
    if (dto.projectInterestId) {
      await this.assertProjectVisible(scope.brokerId, dto.projectInterestId);
    }
    let resolvedUnitProjectId: string | null = null;
    if (dto.unitInterestId) {
      resolvedUnitProjectId = await this.assertUnitVisibleAndReturnProject(
        scope.brokerId,
        dto.unitInterestId,
      );
      if (dto.projectInterestId && dto.projectInterestId !== resolvedUnitProjectId) {
        throw new BadRequestException(
          'unitInterestId does not belong to the supplied projectInterestId',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 2) Find or create the underlying Client (User).
      const client = await this.resolveClient(tx, dto);

      // 3) Duplicate detection by phone. Phone is the canonical contact
      //    identifier in this CRM; if any prior Lead shares it the new one
      //    is marked DUPLICATE for admin review (we don't reject — broker
      //    still gets attribution and admin can promote to APPROVED).
      const phone = dto.phone.trim();
      const duplicateOf = await tx.lead.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
        select: { id: true, brokerId: true, projectInterestId: true, createdAt: true },
      });
      const isDuplicate = Boolean(duplicateOf);

      // 4) Create the lead with broker attribution (scope is the only source).
      const now = new Date();
      const lead = await tx.lead.create({
        data: {
          clientId: client.id,
          fullName: client.fullName,
          phone: client.phone ?? phone,
          email: client.email ?? dto.email ?? null,
          sourceId: dto.sourceId ?? null,
          projectInterestId:
            dto.projectInterestId ?? resolvedUnitProjectId ?? null,
          unitInterestId: dto.unitInterestId ?? null,
          stage: 'NEW',
          brokerId: scope.brokerId,
          brokerAgentId: scope.brokerAgentUserId,
          brokerSubmittedAt: now,
          brokerApprovalStatus: isDuplicate ? 'DUPLICATE' : 'PENDING',
        },
        include: LEAD_INCLUDE,
      });

      // 5) Activity log entries on the existing LeadActivity timeline.
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: 'broker_submitted',
          payload: {
            brokerId: scope.brokerId,
            brokerAgentId: scope.brokerAgentUserId,
            isDuplicate,
            duplicateOfId: duplicateOf?.id ?? null,
          },
        },
      });

      if (dto.note && dto.note.trim()) {
        // Notes need a salesId per schema; broker-portal notes don't have one
        // yet so we attach them as a LeadActivity payload instead. This keeps
        // the schema untouched and surfaces in the timeline.
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: 'broker_note',
            payload: {
              authorBrokerAgentId: scope.brokerAgentUserId,
              body: dto.note.trim(),
            },
          },
        });
      }

      return {
        ...lead,
        isDuplicate,
        duplicateOfId: duplicateOf?.id ?? null,
      };
    });
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  /**
   * Project must have an active BrokerProjectAccess for this broker.
   */
  private async assertProjectVisible(brokerId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const access = await this.prisma.brokerProjectAccess.findFirst({
      where: { brokerId, projectId, active: true },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('Project is not accessible to this broker');
    }
  }

  /**
   * Unit is visible iff its project has active BrokerProjectAccess OR the unit
   * itself has active BrokerUnitAccess. Returns the unit's projectId so the
   * caller can cross-check it against any supplied projectInterestId.
   */
  private async assertUnitVisibleAndReturnProject(
    brokerId: string,
    unitId: string,
  ): Promise<string> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        building: { select: { phase: { select: { projectId: true } } } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const projectId = unit.building.phase.projectId;
    const [projectAccess, unitAccess] = await Promise.all([
      this.prisma.brokerProjectAccess.findFirst({
        where: { brokerId, projectId, active: true },
        select: { id: true },
      }),
      this.prisma.brokerUnitAccess.findFirst({
        where: { brokerId, unitId, active: true },
        select: { id: true },
      }),
    ]);
    if (!projectAccess && !unitAccess) {
      throw new ForbiddenException('Unit is not accessible to this broker');
    }
    return projectId;
  }

  /**
   * Find an existing User by phone (preferred) or email, or create a CLIENT.
   * Mirrors the resolution order used in apps/api/src/modules/leads/leads.service.ts.
   */
  private async resolveClient(
    tx: Prisma.TransactionClient,
    dto: CreatePortalLeadDto,
  ): Promise<{ id: string; fullName: string; phone: string | null; email: string | null }> {
    const phone = dto.phone.trim();
    const email = dto.email?.trim() ?? null;

    const byPhone = await tx.user.findUnique({
      where: { phone },
      select: { id: true, fullName: true, phone: true, email: true },
    });
    if (byPhone) return byPhone;

    if (email) {
      const byEmail = await tx.user.findUnique({
        where: { email },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      if (byEmail) return byEmail;
    }

    try {
      return await tx.user.create({
        data: {
          role: 'CLIENT',
          fullName: dto.fullName.trim(),
          phone,
          email,
          locale: 'ar',
        },
        select: { id: true, fullName: true, phone: true, email: true },
      });
    } catch (e) {
      // Lost-race fallback: another request just inserted the same phone/email.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const retry = await tx.user.findUnique({
          where: { phone },
          select: { id: true, fullName: true, phone: true, email: true },
        });
        if (retry) return retry;
      }
      throw e;
    }
  }
}
