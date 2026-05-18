import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { PortalCommissionsQueryDto } from './dto/portal-commission.dto';

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
      lead: { select: { id: true, fullName: true, phone: true } },
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

    const where: Prisma.BrokerCommissionWhereInput = {
      brokerId: scope.brokerId,
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
    return paginate(data, total, { page, pageSize });
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const commission = await this.prisma.brokerCommission.findFirst({
      where: { id, brokerId: scope.brokerId },
      include: PORTAL_COMMISSION_INCLUDE,
    });
    if (!commission) throw new NotFoundException('Commission not found');
    return commission;
  }
}
