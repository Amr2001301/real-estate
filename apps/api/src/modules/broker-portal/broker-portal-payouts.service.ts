import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { PortalPayoutsQueryDto } from './dto/portal-payout.dto';

const PORTAL_PAYOUT_INCLUDE = {
  commissions: {
    orderBy: { earnedAt: 'asc' as const },
    select: {
      id: true,
      commissionNumber: true,
      grossAmount: true,
      taxAmount: true,
      withholdingAmount: true,
      netAmount: true,
      earnedAt: true,
      contract: {
        select: { id: true, contractNumber: true },
      },
      unit: {
        select: {
          id: true,
          code: true,
          building: {
            select: {
              phase: {
                select: { project: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      project: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class BrokerPortalPayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: BrokerScopeContext, query: PortalPayoutsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.BrokerPayoutWhereInput = {
      brokerId: scope.brokerId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.period ? { period: query.period } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brokerPayout.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...takeSkip({ page, pageSize }),
      }),
      this.prisma.brokerPayout.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const payout = await this.prisma.brokerPayout.findFirst({
      where: { id, brokerId: scope.brokerId },
      include: PORTAL_PAYOUT_INCLUDE,
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }
}
