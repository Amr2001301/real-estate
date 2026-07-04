import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, takeSkip } from '../../common/utils/pagination';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { BrokerContractsQueryDto } from './dto/broker-contract.dto';

const BROKER_CONTRACT_INCLUDE = {
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
  brokerCommission: {
    select: {
      id: true,
      commissionNumber: true,
      commissionPct: true,
      grossAmount: true,
      netAmount: true,
      status: true,
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
export class BrokerContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: BrokerContractsQueryDto, actor: AuthUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Only broker-attributed contracts. SALES users see only those whose
    // source reservation's internal sales handler is themselves — same
    // convention as the broker-reservations admin module.
    const where: Prisma.ContractWhereInput = {
      NOT: { brokerId: null },
      ...(actor.role === 'SALES' ? { reservation: { salesId: actor.sub } } : {}),
      ...(query.brokerId ? { brokerId: query.brokerId } : {}),
      ...(query.projectId
        ? { unit: { building: { phase: { projectId: query.projectId } } } }
        : {}),
      ...(query.salesId && actor.role !== 'SALES'
        ? { reservation: { salesId: query.salesId } }
        : {}),
      ...(query.signed === 'yes'
        ? { signedAt: { not: null } }
        : query.signed === 'no'
          ? { signedAt: null }
          : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...takeSkip({ page, pageSize }),
        include: BROKER_CONTRACT_INCLUDE,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginate(data, total, { page, pageSize });
  }

  async findOne(id: string, actor: AuthUser) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        ...BROKER_CONTRACT_INCLUDE,
        installmentPlan: {
          include: { installments: { orderBy: { dueDate: 'asc' } } },
        },
        deposits: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.brokerId) {
      throw new NotFoundException(
        'This contract is not broker-attributed; use the regular contracts endpoint instead',
      );
    }
    // SALES users can only view contracts whose reservation they handle.
    if (actor.role === 'SALES') {
      const reservation = await this.prisma.reservation.findUnique({
        where: { id: contract.reservationId ?? '' },
        select: { salesId: true },
      });
      if (!reservation || reservation.salesId !== actor.sub) {
        throw new NotFoundException('Contract not found');
      }
    }
    return contract;
  }
}
