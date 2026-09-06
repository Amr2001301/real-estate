import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PortalUnitsQueryDto } from './dto/portal-query.dto';

@Injectable()
export class BrokerPortalService {
  constructor(private readonly prisma: PrismaService) {}

  // ── /portal/me + /portal/profile ────────────────────────────────────────

  async getMe(scope: BrokerScopeContext, _auth: AuthUser) {
    const brokerUser = await this.prisma.brokerUser.findUnique({
      where: { id: scope.brokerUserId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            fullName: true,
            email: true,
            phone: true,
            locale: true,
            active: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        broker: {
          select: {
            id: true,
            companyName: true,
            commercialName: true,
            code: true,
            logoUrl: true,
            email: true,
            phone: true,
            city: true,
            address: true,
            defaultCommissionPct: true,
            commissionModel: true,
            contractStartAt: true,
            contractEndAt: true,
            contractPdfUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!brokerUser) throw new NotFoundException('Broker profile not found');

    return {
      user: brokerUser.user,
      brokerUser: {
        id: brokerUser.id,
        jobTitle: brokerUser.jobTitle,
        isPrimaryContact: brokerUser.isPrimaryContact,
        canManageBrokerUsers: brokerUser.canManageBrokerUsers,
        canViewCommissions: brokerUser.canViewCommissions,
        status: brokerUser.status,
        invitedAt: brokerUser.invitedAt,
        joinedAt: brokerUser.joinedAt,
        createdAt: brokerUser.createdAt,
        updatedAt: brokerUser.updatedAt,
      },
      broker: brokerUser.broker,
      permissions: {
        isPrimaryContact: brokerUser.isPrimaryContact,
        canManageBrokerUsers: brokerUser.canManageBrokerUsers,
        canViewCommissions: brokerUser.canViewCommissions,
      },
    };
  }

  // ── /portal/projects ────────────────────────────────────────────────────

  async listProjects(scope: BrokerScopeContext) {
    const grants = await this.prisma.brokerProjectAccess.findMany({
      where: { brokerId: scope.brokerId, active: true },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            city: true,
            lat: true,
            lng: true,
            status: true,
            featured: true,
            services: true,
            createdAt: true,
            updatedAt: true,
            media: {
              orderBy: { order: 'asc' },
              take: 1,
              select: { id: true, url: true, type: true, order: true },
            },
          },
        },
      },
    });

    return grants.map((g) => ({
      project: g.project,
      access: {
        id: g.id,
        commissionPct: g.commissionPct,
        fixedAmountPerUnit: g.fixedAmountPerUnit,
        startsAt: g.startsAt,
        endsAt: g.endsAt,
        active: g.active,
        createdAt: g.createdAt,
      },
    }));
  }

  // ── /portal/units ───────────────────────────────────────────────────────

  async listUnits(scope: BrokerScopeContext, query: PortalUnitsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [projectGrants, unitGrants] = await Promise.all([
      this.prisma.brokerProjectAccess.findMany({
        where: { brokerId: scope.brokerId, active: true },
        select: { projectId: true },
      }),
      this.prisma.brokerUnitAccess.findMany({
        where: { brokerId: scope.brokerId, active: true },
        select: { unitId: true },
      }),
    ]);

    const accessibleProjectIds = projectGrants.map((g) => g.projectId);
    const explicitUnitIds = unitGrants.map((g) => g.unitId);

    // Nothing accessible → return empty paged response without hitting the DB.
    if (accessibleProjectIds.length === 0 && explicitUnitIds.length === 0) {
      return paginate([], 0, { page, pageSize });
    }

    // Build a where clause that honours both access sources, plus the optional
    // projectId filter from the caller (which must intersect with accessible
    // projects, so a broker can't pivot to a non-accessible project).
    const accessOr: Prisma.UnitWhereInput[] = [];
    if (accessibleProjectIds.length > 0) {
      accessOr.push({
        building: { phase: { projectId: { in: accessibleProjectIds } } },
      });
    }
    if (explicitUnitIds.length > 0) {
      accessOr.push({ id: { in: explicitUnitIds } });
    }

    const where: Prisma.UnitWhereInput = {
      AND: [
        { OR: accessOr },
        ...(query.projectId
          ? [{ building: { phase: { projectId: query.projectId } } }]
          : []),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.type ? [{ type: query.type }] : []),
        ...(query.bedrooms !== undefined ? [{ bedrooms: query.bedrooms }] : []),
        ...(query.bathrooms !== undefined ? [{ bathrooms: query.bathrooms }] : []),
        ...(query.minPrice !== undefined || query.maxPrice !== undefined
          ? [
              {
                price: {
                  ...(query.minPrice !== undefined ? { gte: new Prisma.Decimal(query.minPrice) } : {}),
                  ...(query.maxPrice !== undefined ? { lte: new Prisma.Decimal(query.maxPrice) } : {}),
                },
              },
            ]
          : []),
        ...(query.q
          ? [{ code: { contains: query.q.trim(), mode: 'insensitive' as const } }]
          : []),
      ],
    };

    const [units, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        ...takeSkip({ page, pageSize }),
        include: {
          media: {
            orderBy: { order: 'asc' },
            select: { id: true, url: true, type: true, order: true },
          },
          building: {
            select: {
              id: true,
              name: true,
              phase: {
                select: {
                  id: true,
                  name: true,
                  projectId: true,
                  project: {
                    select: { id: true, name: true, city: true, status: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);

    const projectSet = new Set(accessibleProjectIds);
    const unitSet = new Set(explicitUnitIds);
    const enriched = units.map((u) => {
      const projectId = u.building?.phase?.projectId;
      const viaProject = projectId ? projectSet.has(projectId) : false;
      const viaUnit = unitSet.has(u.id);
      // Prefer PROJECT_ACCESS when both apply — it's the broader grant.
      const accessSource: 'PROJECT_ACCESS' | 'UNIT_ACCESS' = viaProject
        ? 'PROJECT_ACCESS'
        : viaUnit
          ? 'UNIT_ACCESS'
          : 'PROJECT_ACCESS';
      return { ...u, accessSource };
    });

    return paginate(enriched, total, { page, pageSize });
  }
}
