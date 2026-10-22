import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { PortalCommissionsQueryDto } from './dto/portal-commission.dto';
import { agentFilter, brokerFacingPerson, resolveBrokerViewer } from './broker-viewer';
import { EARNED_COMMISSION_WHERE, earnedCommissionNet } from '../installments/live-contract';

const PORTAL_COMMISSION_INCLUDE = {
  brokerAgent: { select: { id: true, fullName: true, email: true, phone: true } },
  contract: {
    select: {
      id: true,
      contractNumber: true,
      totalAmount: true,
      downPayment: true,
      signedAt: true,
      customer: { select: { id: true, fullName: true, phone: true } },
    },
  },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      sales: { select: { id: true, fullName: true } },
      lead: { select: { id: true, fullName: true, phone: true, clientId: true } },
    },
  },
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      building: {
        select: {
          id: true,
          name: true,
          phase: { select: { id: true, name: true, projectId: true } },
        },
      },
    },
  },
  project: { select: { id: true, name: true, city: true, status: true } },
} as const;

@Injectable()
export class BrokerPortalCommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: BrokerScopeContext, query: PortalCommissionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    // An agent who is not a firm manager sees only their own deals.
    const viewer = await resolveBrokerViewer(this.prisma, scope);

    const where: Prisma.BrokerCommissionWhereInput = {
      brokerId: scope.brokerId,
      ...agentFilter(viewer),
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.from || query.to
        ? {
            earnedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { commissionNumber: { contains: query.q.trim(), mode: Prisma.QueryMode.insensitive } },
              { contract: { contractNumber: { contains: query.q.trim(), mode: Prisma.QueryMode.insensitive } } },
              { unit: { code: { contains: query.q.trim(), mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brokerCommission.findMany({
        where,
        orderBy: [{ status: 'asc' }, { earnedAt: 'desc' }],
        ...takeSkip({ page, pageSize }),
        include: PORTAL_COMMISSION_INCLUDE,
      }),
      this.prisma.brokerCommission.count({ where }),
    ]);
    // What the broker earns and keeps over every matching commission — as the
    // admin reports count it (not rejected or cancelled, deal payable, not
    // clawed back, price-change adjustments included). The page summed its
    // own rows, rejected and cancelled ones too.
    const earnedNet = await earnedCommissionNet(this.prisma, { AND: [where, EARNED_COMMISSION_WHERE] });
    return { ...paginate(data.map(brokerFacing), total, { page, pageSize }), earnedNet: earnedNet.toString() };
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const viewer = await resolveBrokerViewer(this.prisma, scope);
    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id, brokerId: scope.brokerId, ...agentFilter(viewer) },
      include: PORTAL_COMMISSION_INCLUDE,
    });
    if (!commission) throw new NotFoundException('Commission not found');
    return brokerFacing(commission);
  }
}

/** After a transfer the contract's owner is not the person the broker brought: show the lead. */
function brokerFacing<
  C extends {
    contract: { customer: { id: string; fullName: string; phone: string | null } | null } | null;
    reservation: { lead: { clientId: string | null; fullName: string; phone: string | null } | null } | null;
  },
>(c: C): C {
  if (!c.contract) return c;
  return { ...c, contract: { ...c.contract, customer: brokerFacingPerson(c.contract.customer, c.reservation?.lead) } };
}
