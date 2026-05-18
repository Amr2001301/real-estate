import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { BrokerScopeContext } from '../../common/guards/broker-scope.guard';
import { PortalContractsQueryDto } from './dto/portal-contract.dto';

const PORTAL_CONTRACT_INCLUDE = {
  customer: {
    select: { id: true, fullName: true, phone: true, email: true },
  },
  unit: {
    select: {
      id: true,
      code: true,
      type: true,
      price: true,
      status: true,
      area: true,
      bedrooms: true,
      bathrooms: true,
      floor: true,
      building: {
        select: {
          id: true,
          name: true,
          phase: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: { id: true, name: true, city: true, status: true },
              },
            },
          },
        },
      },
    },
  },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      commissionLockedPct: true,
      commissionLockedAmount: true,
      sales: { select: { id: true, fullName: true, email: true, phone: true } },
      lead: { select: { id: true, fullName: true, phone: true } },
    },
  },
  installmentPlan: {
    select: {
      id: true,
      totalMonths: true,
      monthlyAmount: true,
      startsAt: true,
      frequency: true,
    },
  },
} as const;

@Injectable()
export class BrokerPortalContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: BrokerScopeContext, query: PortalContractsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ContractWhereInput = {
      brokerId: scope.brokerId,
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.leadId ? { reservation: { leadId: query.leadId } } : {}),
      ...(query.projectId
        ? { unit: { building: { phase: { projectId: query.projectId } } } }
        : {}),
      ...(query.signed === 'yes'
        ? { signedAt: { not: null } }
        : query.signed === 'no'
          ? { signedAt: null }
          : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: PORTAL_CONTRACT_INCLUDE,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(scope: BrokerScopeContext, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, brokerId: scope.brokerId },
      include: {
        ...PORTAL_CONTRACT_INCLUDE,
        installmentPlan: {
          include: { installments: { orderBy: { dueDate: 'asc' } } },
        },
        deposits: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }
}
