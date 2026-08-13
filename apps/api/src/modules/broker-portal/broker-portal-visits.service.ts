import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  VisitRequestSource,
  VisitRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import { getTenantContext } from '../../common/tenant/tenant-context';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import {
  CreatePortalVisitRequestDto,
  PortalVisitsQueryDto,
} from './dto/portal-visit.dto';

const VISIT_REQUEST_INCLUDE = {
  project: { select: { id: true, name: true, city: true } },
  unit: { select: { id: true, code: true, type: true } },
  lead: { select: { id: true, fullName: true, phone: true } },
  appointments: {
    orderBy: { scheduledAt: 'desc' },
    take: 5,
    select: {
      id: true,
      visitNumber: true,
      scheduledAt: true,
      status: true,
    },
  },
} as const;

@Injectable()
export class BrokerPortalVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: BrokerScopeContext, query: PortalVisitsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.VisitRequestWhereInput = {
      brokerId: scope.brokerId,
      ...(query.requestStatus ? { requestStatus: query.requestStatus } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.visitRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: VISIT_REQUEST_INCLUDE,
      }),
      this.prisma.visitRequest.count({ where }),
    ]);

    return paginate(data, total, { page, pageSize });
  }

  async createRequest(
    scope: BrokerScopeContext,
    dto: CreatePortalVisitRequestDto,
  ) {
    // 1) Scope check on project, and unit if supplied.
    await this.assertProjectVisible(scope.brokerId, dto.projectId);
    if (dto.unitId) {
      const unitProjectId = await this.assertUnitVisibleAndReturnProject(
        scope.brokerId,
        dto.unitId,
      );
      if (unitProjectId !== dto.projectId) {
        throw new BadRequestException(
          'unitId does not belong to the supplied projectId',
        );
      }
    }

    // 2) Resolve the Lead this visit is for. If leadId is supplied it must
    //    belong to the same broker; otherwise we either find-or-create a Lead
    //    from customerName/customerPhone, stamped with this broker's attribution.
    let leadId: string | null = null;
    let customerName = dto.customerName?.trim() ?? null;
    let customerPhone = dto.customerPhone?.trim() ?? null;
    let customerEmail = dto.customerEmail?.trim() ?? null;

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, brokerId: scope.brokerId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
        },
      });
      if (!lead) {
        throw new ForbiddenException(
          'Lead not found or not owned by this broker',
        );
      }
      leadId = lead.id;
      customerName = customerName ?? lead.fullName;
      customerPhone = customerPhone ?? lead.phone;
      customerEmail = customerEmail ?? lead.email;
    } else {
      if (!customerName || !customerPhone) {
        throw new BadRequestException(
          'customerName and customerPhone are required when leadId is not provided',
        );
      }
      leadId = await this.findOrCreateBrokerLead(scope, {
        fullName: customerName,
        phone: customerPhone,
        email: customerEmail,
        projectId: dto.projectId,
        unitId: dto.unitId ?? null,
      });
    }

    // 3) Create the VisitRequest with broker attribution. Status starts as
    //    PENDING (legacy column) + NEW (v2 requestStatus), matching the public
    //    visit-request flow. Admin processes from there; we don't auto-confirm.
    const visitRequest = await this.prisma.visitRequest.create({
      data: {
        leadId,
        projectId: dto.projectId,
        unitId: dto.unitId ?? null,
        preferredDate: new Date(dto.preferredDate),
        notes: dto.notes ?? null,
        customerName,
        customerPhone,
        customerEmail,
        requestStatus: VisitRequestStatus.NEW,
        source: VisitRequestSource.OTHER,
        brokerId: scope.brokerId,
        brokerAgentId: scope.brokerAgentUserId,
      },
      include: VISIT_REQUEST_INCLUDE,
    });

    // 4) Record the event on the lead's activity timeline so the broker
    //    activity feed (which reads LeadActivity) surfaces the visit request.
    if (leadId) {
      await this.prisma.leadActivity.create({
        data: {
          leadId,
          type: 'broker_visit_requested',
          payload: {
            brokerId: scope.brokerId,
            brokerAgentId: scope.brokerAgentUserId,
            visitRequestId: visitRequest.id,
            projectId: dto.projectId,
            unitId: dto.unitId ?? null,
            preferredDate: dto.preferredDate,
          },
        },
      });
    }

    return visitRequest;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async findOrCreateBrokerLead(
    scope: BrokerScopeContext,
    info: {
      fullName: string;
      phone: string;
      email: string | null;
      projectId: string;
      unitId: string | null;
    },
  ): Promise<string> {
    // Reuse the same broker's existing lead for this phone if one exists.
    const existing = await this.prisma.lead.findFirst({
      where: { phone: info.phone, brokerId: scope.brokerId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) return existing.id;

    return this.prisma.$transaction(async (tx) => {
      // Find or create the canonical Client User by phone.
      const byPhone = await tx.user.findUnique({
        where: { phone: info.phone },
        select: { id: true, fullName: true, phone: true, email: true },
      });
      const client =
        byPhone ??
        (await tx.user.create({
          data: {
            role: 'CLIENT',
            fullName: info.fullName,
            phone: info.phone,
            email: info.email,
            locale: 'ar',
            companyId: getTenantContext()?.companyId ?? null,
          },
          select: { id: true, fullName: true, phone: true, email: true },
        }));

      // Phone-based duplicate detection across the entire system, like the
      // portal-leads service: if any prior lead with this phone exists, mark
      // the new one as DUPLICATE for admin review.
      const anyExisting = await tx.lead.findFirst({
        where: { phone: info.phone },
        select: { id: true },
      });

      const created = await tx.lead.create({
        data: {
          clientId: client.id,
          fullName: client.fullName,
          phone: client.phone ?? info.phone,
          email: client.email ?? info.email,
          projectInterestId: info.projectId,
          unitInterestId: info.unitId,
          stage: 'NEW',
          brokerId: scope.brokerId,
          brokerAgentId: scope.brokerAgentUserId,
          brokerSubmittedAt: new Date(),
          brokerApprovalStatus: anyExisting ? 'DUPLICATE' : 'PENDING',
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: created.id,
          type: 'broker_submitted_via_visit',
          payload: {
            brokerId: scope.brokerId,
            brokerAgentId: scope.brokerAgentUserId,
            isDuplicate: Boolean(anyExisting),
            duplicateOfId: anyExisting?.id ?? null,
          },
        },
      });

      return created.id;
    });
  }

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
}
